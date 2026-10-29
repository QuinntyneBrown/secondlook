using System.Security.Cryptography;
using System.Text.RegularExpressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Accounts;
using SecondLook.Application.Calls;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Reports;
using SecondLook.Domain.Users;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Application.Reports;

public sealed record FindingDto(Guid Id, string Title, string Note, string Status, int? MinCents, int? MaxCents);

/// <summary>The body shop's part of the report: not requested, in progress or (from J12) ready.</summary>
public sealed record BodyShopDto(string Status, string? ReviewerName, IReadOnlyList<FindingDto> Findings);

/// <summary>
/// The report as the buyer reads it. <c>Findings</c> and the cost totals are the mechanic's estimate alone; the body shop's
/// findings are their own part and never change the totals (ADR 0014).
/// </summary>
public sealed record ReportDto(
    Guid InspectionId, string Review, DateTimeOffset SubmittedAt, DateTimeOffset? CallEndedAt, string? MechanicName, bool MechanicReady,
    string VehicleName, string? Vin, int OdometerKm, int AskingPriceCents,
    IReadOnlyList<FindingDto> Findings, int RequiredCount, int CostMinCents, int CostMaxCents, int AllInMinCents, int AllInMaxCents,
    BodyShopDto BodyShop, string Disclaimer);

public sealed record ShareDto(string Token, string Link, DateTimeOffset ExpiresAt, bool IncludeBodyShop);

public sealed record FindingInput(string? Title, string? Note, string? Status, int? MinCents, int? MaxCents);

public enum ReportFailure { NotFound, Forbidden, NotReady, Conflict, Invalid }

/// <summary>The result of a report request: a value, or why there is none.</summary>
public sealed record ReportOutcome<T>(T? Value, ReportFailure? Failure = null, string? Detail = null, IReadOnlyDictionary<string, string[]>? Errors = null)
{
    public static ReportOutcome<T> Ok(T value) => new(value);
    public static ReportOutcome<T> Fail(ReportFailure failure, string? detail = null) => new(default, failure, detail);
    public static ReportOutcome<T> Invalid(IReadOnlyDictionary<string, string[]> errors) => new(default, ReportFailure.Invalid, null, errors);
}

internal static class ReportMapper
{
    public const string Disclaimer = "This estimate comes from a remote video inspection. It is not a safety certificate or a guarantee of the vehicle’s condition, and a shop may find more once the car is on a lift.";

    public static async Task<Inspection?> ParticipantInspectionAsync(IAppDbContext db, ICurrentUser caller, Guid id, CancellationToken ct) =>
        await CallMapper.ParticipantInspectionAsync(db, caller, id, ct);

    public static async Task<ReportDto> ToDtoAsync(IAppDbContext db, Inspection i, Report report, bool includeBodyShop, CancellationToken ct)
    {
        var rows = (await db.ReportFindings.Where(f => f.ReportId == report.Id).ToListAsync(ct)).OrderBy(f => f.Position).ToList();
        FindingDto Dto(ReportFinding f) => new(f.Id, f.Title, f.Note, f.Status.ToString(), f.MinCents, f.MaxCents);
        var mechanicRows = rows.Where(f => f.Source == FindingSource.Mechanic).ToList();
        var required = mechanicRows.Where(f => f.Status == FindingStatus.Required).ToList();
        var min = required.Sum(f => f.MinCents ?? 0);
        var max = required.Sum(f => f.MaxCents ?? 0);
        var asking = (int)Math.Round(i.AskingPrice * 100);
        var mechanic = report.MechanicId is { } mid ? await db.Users.FirstAsync(u => u.Id == mid, ct) : null;
        var ended = (await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct))?.EndedAt;

        BodyShopDto bodyShop;
        if (i.BodyShopId is not { } shopId) bodyShop = new("NotRequested", null, []);
        else if (!includeBodyShop) bodyShop = new("NotShared", null, []);
        else
        {
            var reviewer = (await db.Users.FirstAsync(u => u.Id == shopId, ct)).DisplayName;
            bodyShop = report.BodyShopSubmittedAt is null
                ? new("InProgress", reviewer, [])
                : new("Ready", reviewer, rows.Where(f => f.Source == FindingSource.BodyShop).Select(Dto).ToList());
        }

        return new ReportDto(i.Id, i.Review.ToString(), report.MechanicSubmittedAt ?? report.BodyShopSubmittedAt ?? default, ended, mechanic?.DisplayName, report.MechanicSubmittedAt is not null,
            VehicleName.Of(i.Year, i.Make, i.Model, i.Vin), i.Vin, i.OdometerKm, asking, mechanicRows.Select(Dto).ToList(), required.Count, min, max, asking + min, asking + max, bodyShop, Disclaimer);
    }
}

/// <summary>The checks both parts of a report share: how many findings, what each may say, and what costs are allowed.</summary>
internal static class FindingRules
{
    public const int MaxFindings = 30;
    public const int MaxCents = 10_000_000;

    public static (Dictionary<string, string[]> Errors, List<(string Title, string Note, FindingStatus Status, int? Min, int? Max)> Parsed) Validate(IReadOnlyList<FindingInput>? input)
    {
        var errors = new Dictionary<string, string[]>();
        input ??= [];
        if (input.Count is 0 or > MaxFindings) errors["findings"] = [$"Add 1 to {MaxFindings} findings."];
        var parsed = new List<(string Title, string Note, FindingStatus Status, int? Min, int? Max)>();
        for (var n = 0; n < input.Count; n++)
        {
            var f = input[n];
            var title = (f.Title ?? "").Trim();
            var note = (f.Note ?? "").Trim();
            if (title.Length is 0 or > 200) errors[$"findings[{n}].title"] = ["Give the finding a title of up to 200 characters."];
            if (note.Length > 500) errors[$"findings[{n}].note"] = ["Keep the note to 500 characters."];
            if (!Enum.TryParse<FindingStatus>(f.Status, true, out var status) || !Enum.IsDefined(status))
            {
                errors[$"findings[{n}].status"] = ["Choose Required, Recommended or Passes."];
                continue;
            }
            if ((f.MinCents is null) != (f.MaxCents is null)) errors[$"findings[{n}].cost"] = ["Give both ends of the cost range, or neither."];
            else if (f.MinCents is { } lo && f.MaxCents is { } hi)
            {
                if (lo < 0 || hi < lo || hi > MaxCents) errors[$"findings[{n}].cost"] = ["Use a cost range from zero up to $100,000, lowest first."];
                else if (status == FindingStatus.Passes) errors[$"findings[{n}].cost"] = ["A finding that passes has no cost."];
            }
            parsed.Add((title, note, status, f.MinCents, f.MaxCents));
        }
        return (errors, parsed);
    }

    /// <summary>Replaces one part's findings, leaving the other part's alone.</summary>
    public static void Replace(IAppDbContext db, Report report, FindingSource source, IEnumerable<(string Title, string Note, FindingStatus Status, int? Min, int? Max)> parsed)
    {
        db.ReportFindings.RemoveRange(db.ReportFindings.Where(f => f.ReportId == report.Id && f.Source == source));
        var position = 0;
        foreach (var f in parsed)
            db.ReportFindings.Add(new ReportFinding { Id = Guid.NewGuid(), ReportId = report.Id, Source = source, Position = position++, Title = f.Title, Note = f.Note, Status = f.Status, MinCents = f.Min, MaxCents = f.Max });
    }
}

public sealed record SubmitReportCommand(Guid InspectionId, IReadOnlyList<FindingInput>? Findings) : IRequest<ReportOutcome<ReportDto>>;

/// <summary>The assigned mechanic submits (or replaces) the estimate once the call has ended (L2-050).</summary>
public sealed class SubmitReportHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<SubmitReportCommand, ReportOutcome<ReportDto>>
{
    public async Task<ReportOutcome<ReportDto>> Handle(SubmitReportCommand c, CancellationToken ct)
    {
        var i = await ReportMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.NotFound);
        if (caller.Role != UserRole.Mechanic) return ReportOutcome<ReportDto>.Fail(ReportFailure.Forbidden);

        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session?.EndedAt is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.Conflict, "Write the report once the call has ended.");

        var (errors, parsed) = FindingRules.Validate(c.Findings);
        if (errors.Count > 0) return ReportOutcome<ReportDto>.Invalid(errors);

        var report = await db.Reports.FirstOrDefaultAsync(r => r.InspectionId == i.Id, ct);
        if (report is null)
        {
            report = new Report { Id = Guid.NewGuid(), InspectionId = i.Id };
            db.Reports.Add(report);
        }
        report.MechanicId = caller.Id;
        report.MechanicSubmittedAt = clock.GetUtcNow();
        FindingRules.Replace(db, report, FindingSource.Mechanic, parsed);
        await db.SaveChangesAsync(ct);
        return ReportOutcome<ReportDto>.Ok(await ReportMapper.ToDtoAsync(db, i, report, true, ct));
    }
}

public sealed record SubmitBodyShopReviewCommand(Guid InspectionId, IReadOnlyList<FindingInput>? Findings) : IRequest<ReportOutcome<ReportDto>>;

/// <summary>The assigned body shop submits (or replaces) its findings once the call has ended (L2-062); the mechanic's part is untouched.</summary>
public sealed class SubmitBodyShopReviewHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<SubmitBodyShopReviewCommand, ReportOutcome<ReportDto>>
{
    public async Task<ReportOutcome<ReportDto>> Handle(SubmitBodyShopReviewCommand c, CancellationToken ct)
    {
        var i = await ReportMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.NotFound);
        if (caller.Role != UserRole.BodyShop) return ReportOutcome<ReportDto>.Fail(ReportFailure.Forbidden);

        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session?.EndedAt is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.Conflict, "Write the body review once the call has ended.");

        var (errors, parsed) = FindingRules.Validate(c.Findings);
        if (errors.Count > 0) return ReportOutcome<ReportDto>.Invalid(errors);

        var report = await db.Reports.FirstOrDefaultAsync(r => r.InspectionId == i.Id, ct);
        if (report is null)
        {
            report = new Report { Id = Guid.NewGuid(), InspectionId = i.Id };
            db.Reports.Add(report);
        }
        report.BodyShopId = caller.Id;
        report.BodyShopSubmittedAt = clock.GetUtcNow();
        FindingRules.Replace(db, report, FindingSource.BodyShop, parsed);
        await db.SaveChangesAsync(ct);
        return ReportOutcome<ReportDto>.Ok(await ReportMapper.ToDtoAsync(db, i, report, true, ct));
    }
}

public sealed record AssignedReviewDto(Guid InspectionId, string VehicleName, string? Vin, DateTimeOffset Start, string Review, string CallStatus, bool Delivered);

public sealed record ListAssignedReviewsQuery : IRequest<IReadOnlyList<AssignedReviewDto>>;

/// <summary>The body shop's queue: its own scheduled inspections, soonest first, with where each stands (L2-058).</summary>
public sealed class ListAssignedReviewsHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<ListAssignedReviewsQuery, IReadOnlyList<AssignedReviewDto>>
{
    public async Task<IReadOnlyList<AssignedReviewDto>> Handle(ListAssignedReviewsQuery q, CancellationToken ct)
    {
        var mine = (await db.Inspections.ForCaller(caller).ToListAsync(ct)).Where(i => i.Status == InspectionStatus.Scheduled).OrderBy(i => i.StartUtc).ToList();
        var ids = mine.Select(i => i.Id).ToList();
        var sessions = await db.CallSessions.Where(s => ids.Contains(s.InspectionId)).ToDictionaryAsync(s => s.InspectionId, ct);
        var delivered = (await db.Reports.Where(r => ids.Contains(r.InspectionId) && r.BodyShopSubmittedAt != null).Select(r => r.InspectionId).ToListAsync(ct)).ToHashSet();
        return mine.Select(i =>
        {
            var status = !sessions.TryGetValue(i.Id, out var s) ? "NotStarted" : s.EndedAt is null ? "Live" : "Ended";
            return new AssignedReviewDto(i.Id, VehicleName.Of(i.Year, i.Make, i.Model, i.Vin), i.Vin, i.StartUtc, i.Review.ToString(), status, delivered.Contains(i.Id));
        }).ToList();
    }
}

public sealed record GetReportQuery(Guid InspectionId) : IRequest<ReportOutcome<ReportDto>>;

/// <summary>Reads the report: the buyer, the assigned mechanic and an assigned body shop only (L2-057, L2-058).</summary>
public sealed class GetReportHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<GetReportQuery, ReportOutcome<ReportDto>>
{
    public async Task<ReportOutcome<ReportDto>> Handle(GetReportQuery q, CancellationToken ct)
    {
        var i = await ReportMapper.ParticipantInspectionAsync(db, caller, q.InspectionId, ct);
        if (i is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.NotFound);
        var report = await db.Reports.FirstOrDefaultAsync(r => r.InspectionId == i.Id, ct);
        if (report is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.NotReady, "The mechanic is still writing it.");
        return ReportOutcome<ReportDto>.Ok(await ReportMapper.ToDtoAsync(db, i, report, true, ct));
    }
}

public sealed record GetReportPdfQuery(Guid InspectionId) : IRequest<ReportOutcome<byte[]>>;

public sealed class GetReportPdfHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<GetReportPdfQuery, ReportOutcome<byte[]>>
{
    public async Task<ReportOutcome<byte[]>> Handle(GetReportPdfQuery q, CancellationToken ct)
    {
        var i = await ReportMapper.ParticipantInspectionAsync(db, caller, q.InspectionId, ct);
        if (i is null) return ReportOutcome<byte[]>.Fail(ReportFailure.NotFound);
        var report = await db.Reports.FirstOrDefaultAsync(r => r.InspectionId == i.Id, ct);
        if (report is null) return ReportOutcome<byte[]>.Fail(ReportFailure.NotReady, "The mechanic is still writing it.");
        return ReportOutcome<byte[]>.Ok(ReportPdf.Render(await ReportMapper.ToDtoAsync(db, i, report, true, ct)));
    }
}

internal static class ShareRules
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(14);

    /// <summary>The buyer of an inspection that has a report; providers are refused and strangers find nothing.</summary>
    public static async Task<(Inspection? Inspection, Report? Report, ReportFailure? Failure)> BuyerReportAsync(IAppDbContext db, ICurrentUser caller, Guid inspectionId, CancellationToken ct)
    {
        var i = await ReportMapper.ParticipantInspectionAsync(db, caller, inspectionId, ct);
        if (i is null) return (null, null, ReportFailure.NotFound);
        if (caller.Role != UserRole.Buyer) return (null, null, ReportFailure.Forbidden);
        var report = await db.Reports.FirstOrDefaultAsync(r => r.InspectionId == i.Id, ct);
        return report is null ? (i, null, ReportFailure.NotReady) : (i, report, null);
    }

    public static ShareDto ToDto(ReportShare s) => new(s.Token, $"/shared/{s.Token}", s.ExpiresAt, s.IncludeBodyShop);
}

public sealed record EnsureShareCommand(Guid InspectionId, bool IncludeBodyShop) : IRequest<ReportOutcome<ShareDto>>;

/// <summary>Returns the buyer's active share link, creating it if there is none; asking again returns the same link.</summary>
public sealed class EnsureShareHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<EnsureShareCommand, ReportOutcome<ShareDto>>
{
    public async Task<ReportOutcome<ShareDto>> Handle(EnsureShareCommand c, CancellationToken ct)
    {
        var (_, report, failure) = await ShareRules.BuyerReportAsync(db, caller, c.InspectionId, ct);
        if (failure is { } f) return ReportOutcome<ShareDto>.Fail(f);
        var now = clock.GetUtcNow();
        var share = (await db.ReportShares.Where(s => s.ReportId == report!.Id && s.RevokedAt == null).ToListAsync(ct)).FirstOrDefault(s => s.ExpiresAt > now);
        if (share is null)
        {
            share = new ReportShare
            {
                Id = Guid.NewGuid(), ReportId = report!.Id, CreatedAt = now, ExpiresAt = now + ShareRules.Lifetime,
                Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('='),
            };
            db.ReportShares.Add(share);
        }
        share.IncludeBodyShop = c.IncludeBodyShop;
        await db.SaveChangesAsync(ct);
        return ReportOutcome<ShareDto>.Ok(ShareRules.ToDto(share));
    }
}

public sealed record EmailShareCommand(Guid InspectionId, string? Email) : IRequest<ReportOutcome<string>>;

public sealed partial class EmailShareHandler(IAppDbContext db, ICurrentUser caller, IEmailSender mail, TimeProvider clock) : IRequestHandler<EmailShareCommand, ReportOutcome<string>>
{
    public const string Purpose = "share-report";

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex Address();

    public async Task<ReportOutcome<string>> Handle(EmailShareCommand c, CancellationToken ct)
    {
        var (_, report, failure) = await ShareRules.BuyerReportAsync(db, caller, c.InspectionId, ct);
        if (failure is { } f) return ReportOutcome<string>.Fail(f);
        var email = (c.Email ?? "").Trim().ToLowerInvariant();
        if (email.Length > 254 || !Address().IsMatch(email))
            return ReportOutcome<string>.Invalid(new Dictionary<string, string[]> { ["email"] = ["Enter a valid email address, like name@example.com."] });
        var now = clock.GetUtcNow();
        var share = (await db.ReportShares.Where(s => s.ReportId == report!.Id && s.RevokedAt == null).ToListAsync(ct)).FirstOrDefault(s => s.ExpiresAt > now);
        if (share is null) return ReportOutcome<string>.Fail(ReportFailure.Conflict, "Create the link first.");
        await mail.SendLinkAsync(email, Purpose, share.Token, ct);
        return ReportOutcome<string>.Ok(email);
    }
}

public sealed record RevokeShareCommand(Guid InspectionId) : IRequest<ReportOutcome<bool>>;

/// <summary>Turns the link off; turning it off again changes nothing.</summary>
public sealed class RevokeShareHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<RevokeShareCommand, ReportOutcome<bool>>
{
    public async Task<ReportOutcome<bool>> Handle(RevokeShareCommand c, CancellationToken ct)
    {
        var (_, report, failure) = await ShareRules.BuyerReportAsync(db, caller, c.InspectionId, ct);
        if (failure is ReportFailure.NotFound or ReportFailure.Forbidden) return ReportOutcome<bool>.Fail(failure.Value);
        if (report is null) return ReportOutcome<bool>.Ok(true);
        var now = clock.GetUtcNow();
        var id = report.Id;
        await db.ReportShares.Where(s => s.ReportId == id && s.RevokedAt == null).ExecuteUpdateAsync(set => set.SetProperty(s => s.RevokedAt, (DateTimeOffset?)now), ct);
        return ReportOutcome<bool>.Ok(true);
    }
}

public sealed record GetSharedReportQuery(string Token) : IRequest<ReportOutcome<ReportDto>>;

/// <summary>Reads a report through its share link, with no account. An unknown, expired or turned-off link finds nothing.</summary>
public sealed class GetSharedReportHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<GetSharedReportQuery, ReportOutcome<ReportDto>>
{
    public async Task<ReportOutcome<ReportDto>> Handle(GetSharedReportQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var token = q.Token;
        var share = (await db.ReportShares.Where(s => s.Token == token && s.RevokedAt == null).ToListAsync(ct)).FirstOrDefault(s => s.ExpiresAt > now);
        if (share is null) return ReportOutcome<ReportDto>.Fail(ReportFailure.NotFound);
        var report = await db.Reports.FirstAsync(r => r.Id == share.ReportId, ct);
        var inspection = await db.Inspections.FirstAsync(i => i.Id == report.InspectionId, ct);
        return ReportOutcome<ReportDto>.Ok(await ReportMapper.ToDtoAsync(db, inspection, report, share.IncludeBodyShop, ct));
    }
}

public sealed record ReportIssueCommand(Guid InspectionId, string? Reason, string? Details) : IRequest<ReportOutcome<Guid>>;

public sealed class ReportIssueHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<ReportIssueCommand, ReportOutcome<Guid>>
{
    public async Task<ReportOutcome<Guid>> Handle(ReportIssueCommand c, CancellationToken ct)
    {
        var (_, report, failure) = await ShareRules.BuyerReportAsync(db, caller, c.InspectionId, ct);
        if (failure is { } f) return ReportOutcome<Guid>.Fail(f);
        if (!Enum.TryParse<IssueReason>(c.Reason, true, out var reason) || !Enum.IsDefined(reason))
            return ReportOutcome<Guid>.Invalid(new Dictionary<string, string[]> { ["reason"] = ["Choose what’s wrong."] });
        var details = (c.Details ?? "").Trim();
        if (details.Length > 1000)
            return ReportOutcome<Guid>.Invalid(new Dictionary<string, string[]> { ["details"] = ["Keep it to 1,000 characters."] });
        var issue = new ReportIssue { Id = Guid.NewGuid(), ReportId = report!.Id, ReporterId = caller.Id, Reason = reason, Details = details, CreatedAt = clock.GetUtcNow() };
        db.ReportIssues.Add(issue);
        await db.SaveChangesAsync(ct);
        return ReportOutcome<Guid>.Ok(issue.Id);
    }
}

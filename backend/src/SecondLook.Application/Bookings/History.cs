using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Reports;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Application.Bookings;

/// <summary>What the mechanic found, for a row: Required repairs with their cost, else Recommended, else Passes.</summary>
public sealed record EstimateSummaryDto(string State, int RequiredCount, int? CostMinCents, int? CostMaxCents);

/// <summary>
/// One inspection in the buyer's history. <c>Phase</c> is Upcoming, Live, CallEnded (the call is done and the report is not),
/// ReportReady or Cancelled. A cancelled inspection keeps what it was booked with.
/// </summary>
public sealed record HistoryItemDto(
    Guid Id, string VehicleName, string? Vin, string Review, string? MechanicName, string? BodyShopName, int AskingPriceCents, DateTimeOffset Start, string Phase,
    EstimateSummaryDto? Estimate, DateTimeOffset? CancelledAt, int RefundedCents);

public sealed record HistoryDto(string Tab, int Page, int PageSize, int Total, int ActiveCount, int PastCount, IReadOnlyList<HistoryItemDto> Items);

public abstract record HistoryResult
{
    public sealed record Ok(HistoryDto History) : HistoryResult;
    public sealed record BadTab : HistoryResult;
}

public sealed record GetHistoryQuery(string? Tab, string? Page) : IRequest<HistoryResult>;

/// <summary>
/// The buyer's inspections in pages (L2-019 to L2-022, ADR 0016). Active are the ones not finished with; Past are cancelled ones and ones
/// whose review is delivered (every part the review includes). Active is soonest first, Past newest first.
/// </summary>
public sealed class GetHistoryHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<GetHistoryQuery, HistoryResult>
{
    public const int PageSize = 20;

    public async Task<HistoryResult> Handle(GetHistoryQuery q, CancellationToken ct)
    {
        var past = q.Tab?.Trim().ToLowerInvariant() switch { "active" => false, "past" => true, _ => (bool?)null };
        if (past is null) return new HistoryResult.BadTab();

        var all = await db.Inspections.ForBuyer(caller).ToListAsync(ct);
        var ids = all.Select(i => i.Id).ToList();
        var sessions = await db.CallSessions.Where(s => ids.Contains(s.InspectionId)).ToDictionaryAsync(s => s.InspectionId, ct);
        var reports = await db.Reports.Where(r => ids.Contains(r.InspectionId)).ToDictionaryAsync(r => r.InspectionId, ct);
        var reportIds = reports.Values.Select(r => r.Id).ToList();
        var findings = (await db.ReportFindings.Where(f => reportIds.Contains(f.ReportId)).ToListAsync(ct)).GroupBy(f => f.ReportId).ToDictionary(g => g.Key, g => g.ToList());

        static bool Delivered(Inspection i, Report? r) => i.Review switch
        {
            ReviewType.Mechanic => r?.MechanicSubmittedAt is not null,
            ReviewType.BodyShop => r?.BodyShopSubmittedAt is not null,
            _ => r?.MechanicSubmittedAt is not null && r.BodyShopSubmittedAt is not null,
        };

        var rows = all.Select(i =>
        {
            reports.TryGetValue(i.Id, out var report);
            var delivered = Delivered(i, report);
            var cancelled = i.Status == InspectionStatus.Cancelled;
            return (Inspection: i, Report: report, Delivered: delivered, IsPast: cancelled || delivered);
        }).ToList();

        var active = rows.Where(r => !r.IsPast).OrderBy(r => r.Inspection.StartUtc).ToList();
        var pastRows = rows.Where(r => r.IsPast).OrderByDescending(r => r.Inspection.StartUtc).ToList();
        var chosen = past.Value ? pastRows : active;

        var page = int.TryParse(q.Page, out var p) && p >= 1 ? p : 1;
        var users = await db.Users.Where(u => all.Select(i => i.MechanicId).Concat(all.Select(i => i.BodyShopId)).Where(x => x != null).Select(x => x!.Value).Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        string? Name(Guid? id) => id is { } g && users.TryGetValue(g, out var u) ? u.DisplayName : null;

        var items = chosen.Skip((page - 1) * PageSize).Take(PageSize).Select(r =>
        {
            var i = r.Inspection;
            var phase = i.Status == InspectionStatus.Cancelled ? "Cancelled"
                : r.Delivered ? "ReportReady"
                : !sessions.TryGetValue(i.Id, out var s) ? "Upcoming"
                : s.EndedAt is null ? "Live" : "CallEnded";
            return new HistoryItemDto(i.Id, VehicleName.Of(i.Year, i.Make, i.Model, i.Vin), i.Vin, i.Review.ToString(), Name(i.MechanicId), Name(i.BodyShopId), (int)Math.Round(i.AskingPrice * 100), i.StartUtc, phase,
                Summary(i, r.Report, findings), i.CancelledAt, i.RefundedCents);
        }).ToList();

        return new HistoryResult.Ok(new HistoryDto(past.Value ? "Past" : "Active", page, PageSize, chosen.Count, active.Count, pastRows.Count, items));
    }

    /// <summary>The summary comes from the mechanic's findings, or from the body shop's for a review with the shop alone.</summary>
    private static EstimateSummaryDto? Summary(Inspection i, Report? report, Dictionary<Guid, List<ReportFinding>> findings)
    {
        if (report is null || i.Status == InspectionStatus.Cancelled) return null;
        var source = i.Review == ReviewType.BodyShop ? FindingSource.BodyShop : FindingSource.Mechanic;
        var delivered = source == FindingSource.BodyShop ? report.BodyShopSubmittedAt is not null : report.MechanicSubmittedAt is not null;
        if (!delivered || !findings.TryGetValue(report.Id, out var all)) return null;
        var mine = all.Where(f => f.Source == source).ToList();
        var required = mine.Where(f => f.Status == FindingStatus.Required).ToList();
        if (required.Count > 0) return new EstimateSummaryDto("Required", required.Count, required.Sum(f => f.MinCents ?? 0), required.Sum(f => f.MaxCents ?? 0));
        return new EstimateSummaryDto(mine.Any(f => f.Status == FindingStatus.Recommended) ? "Recommended" : "Passes", 0, null, null);
    }
}

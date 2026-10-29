using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Calls;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Calls;

/// <summary>How long before the booked start a call can be joined (`SecondLook:Calls:OpensBeforeMinutes`, default 15).</summary>
public sealed record CallOptions(TimeSpan OpensBefore);

public sealed record ParticipantDto(Guid? UserId, string Name, string Role, bool Here);
public sealed record ChecklistItemDto(string Name, string State);
public sealed record NoteDto(string Author, string Text, DateTimeOffset At);

public sealed record CallStateDto(
    Guid InspectionId, string Status, DateTimeOffset Start, DateTimeOffset OpensAt, DateTimeOffset? StartedAt, DateTimeOffset? EndedAt, int? DurationSeconds,
    string Vin, ParticipantDto You, IReadOnlyList<ParticipantDto> Participants, IReadOnlyList<ChecklistItemDto> Checklist, IReadOnlyList<NoteDto> Notes);

public abstract record CallResult
{
    public sealed record Ok(CallStateDto State) : CallResult;
    public sealed record NotFound : CallResult;
    /// <summary>The call is not open yet; says when it opens.</summary>
    public sealed record NotYetOpen(DateTimeOffset OpensAt) : CallResult;
    /// <summary>The inspection is cancelled, or the call has not started or has ended.</summary>
    public sealed record NotAllowed(string Detail) : CallResult;
    public sealed record Forbidden : CallResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : CallResult;
}

internal static class CallMapper
{
    public static string RoleName(UserRole role) => role.ToString();

    /// <summary>The inspection when the caller is the buyer or an assigned provider; anyone else gets nothing (L2-057, L2-058).</summary>
    public static async Task<Inspection?> ParticipantInspectionAsync(IAppDbContext db, ICurrentUser caller, Guid id, CancellationToken ct) =>
        caller.Role is UserRole.Admin ? null : await db.Inspections.ForCaller(caller).FirstOrDefaultAsync(i => i.Id == id, ct);

    public static async Task<CallStateDto> StateAsync(IAppDbContext db, ICallChannel channel, ICurrentUser caller, CallOptions options, Inspection i, CancellationToken ct)
    {
        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        var ids = new[] { i.BuyerId, i.MechanicId, i.BodyShopId }.Where(x => x != null).Select(x => x!.Value).ToList();
        var users = await db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, ct);
        var present = channel.PresentUsers(i.Id).ToHashSet();

        ParticipantDto Person(Guid id, string role) => new(id, users[id].DisplayName, role, present.Contains(id));
        var people = new List<ParticipantDto> { Person(i.BuyerId, "Buyer") };
        if (i.MechanicId is { } m) people.Add(Person(m, "Mechanic"));
        if (i.BodyShopId is { } b) people.Add(Person(b, "BodyShop"));
        // The seller joins from a text link, which is not built yet (ADR 0012), so the seller is never here.
        people.Add(new ParticipantDto(null, i.SellerName, "Seller", false));
        var you = people.First(p => p.UserId == caller.Id);

        var index = session?.ChecklistIndex ?? -1;
        var checklist = CallSession.Checklist.Select((name, n) => new ChecklistItemDto(name, session is null || n > index ? "Next" : n == index ? "Now" : "Done")).ToList();
        var notes = session is null ? [] : (await db.CallNotes.Where(n => n.CallSessionId == session.Id).ToListAsync(ct)).OrderBy(n => n.CreatedAt).Select(n => new NoteDto(n.AuthorName, n.Text, n.CreatedAt)).ToList();

        var status = session is null ? "NotStarted" : session.EndedAt is null ? "Live" : "Ended";
        int? duration = session?.EndedAt is { } end ? (int)(end - session.StartedAt).TotalSeconds : null;
        return new CallStateDto(i.Id, status, i.StartUtc, i.StartUtc - options.OpensBefore, session?.StartedAt, session?.EndedAt, duration, i.Vin, you, people, checklist, notes);
    }
}

public sealed record GetCallQuery(Guid InspectionId) : IRequest<CallResult>;

/// <summary>The lobby's view of a call; reading it never joins.</summary>
public sealed class GetCallHandler(IAppDbContext db, ICurrentUser caller, ICallChannel channel, CallOptions options) : IRequestHandler<GetCallQuery, CallResult>
{
    public async Task<CallResult> Handle(GetCallQuery q, CancellationToken ct) =>
        await CallMapper.ParticipantInspectionAsync(db, caller, q.InspectionId, ct) is { } i
            ? new CallResult.Ok(await CallMapper.StateAsync(db, channel, caller, options, i, ct))
            : new CallResult.NotFound();
}

public sealed record JoinCallCommand(Guid InspectionId) : IRequest<CallResult>;

/// <summary>Creates the call on the first join and returns its state; joining again changes nothing (ADR 0012).</summary>
public sealed class JoinCallHandler(IAppDbContext db, ICurrentUser caller, ICallChannel channel, CallOptions options, TimeProvider clock) : IRequestHandler<JoinCallCommand, CallResult>
{
    public async Task<CallResult> Handle(JoinCallCommand c, CancellationToken ct)
    {
        var i = await CallMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return new CallResult.NotFound();
        if (i.Status == InspectionStatus.Cancelled) return new CallResult.NotAllowed("This inspection was cancelled, so there is no call.");

        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session is null)
        {
            var now = clock.GetUtcNow();
            var opens = i.StartUtc - options.OpensBefore;
            if (now < opens) return new CallResult.NotYetOpen(opens);
            db.CallSessions.Add(new CallSession { Id = Guid.NewGuid(), InspectionId = i.Id, StartedAt = DateTimeOffset.FromUnixTimeMilliseconds(now.ToUnixTimeMilliseconds()) });
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // The other participant created it a moment earlier (unique index): carry on with theirs.
                db.ChangeTracker.Clear();
            }
        }
        return new CallResult.Ok(await CallMapper.StateAsync(db, channel, caller, options, i, ct));
    }
}

public abstract record SocketAccess
{
    public sealed record Allowed(Guid UserId, string Name, string Role) : SocketAccess;
    public sealed record NotFound : SocketAccess;
    public sealed record NotLive : SocketAccess;
}

public sealed record OpenSocketQuery(Guid InspectionId) : IRequest<SocketAccess>;

/// <summary>A signalling socket needs a participant and a call that has started and not ended.</summary>
public sealed class OpenSocketHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<OpenSocketQuery, SocketAccess>
{
    public async Task<SocketAccess> Handle(OpenSocketQuery q, CancellationToken ct)
    {
        var i = await CallMapper.ParticipantInspectionAsync(db, caller, q.InspectionId, ct);
        if (i is null) return new SocketAccess.NotFound();
        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session is null || session.EndedAt is not null) return new SocketAccess.NotLive();
        var name = (await db.Users.FirstAsync(u => u.Id == caller.Id, ct)).DisplayName;
        return new SocketAccess.Allowed(caller.Id, name, CallMapper.RoleName(caller.Role));
    }
}

public sealed record EndCallCommand(Guid InspectionId) : IRequest<CallResult>;

/// <summary>Ends the call for everyone once; a repeated request returns the ended call (L2-043).</summary>
public sealed class EndCallHandler(IAppDbContext db, ICurrentUser caller, ICallChannel channel, CallOptions options, TimeProvider clock) : IRequestHandler<EndCallCommand, CallResult>
{
    public async Task<CallResult> Handle(EndCallCommand c, CancellationToken ct)
    {
        var i = await CallMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return new CallResult.NotFound();
        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session is null) return new CallResult.NotAllowed("The call hasn’t started.");

        var now = clock.GetUtcNow();
        var id = session.Id;
        var caller_ = caller.Id;
        var won = await db.CallSessions.Where(s => s.Id == id && s.EndedAt == null)
            .ExecuteUpdateAsync(set => set.SetProperty(s => s.EndedAt, (DateTimeOffset?)now).SetProperty(s => s.EndedByUserId, (Guid?)caller_), ct);
        if (won > 0) await channel.EndAsync(i.Id, ct);
        db.ChangeTracker.Clear();
        var fresh = await db.Inspections.FirstAsync(x => x.Id == i.Id, ct);
        return new CallResult.Ok(await CallMapper.StateAsync(db, channel, caller, options, fresh, ct));
    }
}

public sealed record AdvanceChecklistCommand(Guid InspectionId) : IRequest<CallResult>;

/// <summary>The mechanic moves the checklist to the next item; the buyer and body shop cannot.</summary>
public sealed class AdvanceChecklistHandler(IAppDbContext db, ICurrentUser caller, ICallChannel channel, CallOptions options) : IRequestHandler<AdvanceChecklistCommand, CallResult>
{
    public async Task<CallResult> Handle(AdvanceChecklistCommand c, CancellationToken ct)
    {
        var i = await CallMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return new CallResult.NotFound();
        if (caller.Role != UserRole.Mechanic) return new CallResult.Forbidden();
        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session is null || session.EndedAt is not null) return new CallResult.NotAllowed("The call isn’t live.");

        var last = CallSession.Checklist.Length;
        var id = session.Id;
        var moved = await db.CallSessions.Where(s => s.Id == id && s.EndedAt == null && s.ChecklistIndex < last)
            .ExecuteUpdateAsync(set => set.SetProperty(s => s.ChecklistIndex, s => s.ChecklistIndex + 1), ct);
        if (moved > 0) await channel.NotifyChangedAsync(i.Id, ct);
        db.ChangeTracker.Clear();
        return new CallResult.Ok(await CallMapper.StateAsync(db, channel, caller, options, i, ct));
    }
}

public sealed record AddNoteCommand(Guid InspectionId, string? Text) : IRequest<CallResult>;

public sealed class AddNoteHandler(IAppDbContext db, ICurrentUser caller, ICallChannel channel, CallOptions options, TimeProvider clock) : IRequestHandler<AddNoteCommand, CallResult>
{
    public const int MaxLength = 500;

    public async Task<CallResult> Handle(AddNoteCommand c, CancellationToken ct)
    {
        var i = await CallMapper.ParticipantInspectionAsync(db, caller, c.InspectionId, ct);
        if (i is null) return new CallResult.NotFound();
        if (caller.Role != UserRole.Mechanic) return new CallResult.Forbidden();
        var text = (c.Text ?? "").Trim();
        if (text.Length is 0 or > MaxLength)
            return new CallResult.Invalid(new Dictionary<string, string[]> { ["text"] = [$"Write a note of 1 to {MaxLength} characters."] });
        var session = await db.CallSessions.FirstOrDefaultAsync(s => s.InspectionId == i.Id, ct);
        if (session is null || session.EndedAt is not null) return new CallResult.NotAllowed("The call isn’t live.");

        var name = (await db.Users.FirstAsync(u => u.Id == caller.Id, ct)).DisplayName;
        db.CallNotes.Add(new CallNote { Id = Guid.NewGuid(), CallSessionId = session.Id, AuthorId = caller.Id, AuthorName = name, Text = text, CreatedAt = clock.GetUtcNow() });
        await db.SaveChangesAsync(ct);
        await channel.NotifyChangedAsync(i.Id, ct);
        return new CallResult.Ok(await CallMapper.StateAsync(db, channel, caller, options, i, ct));
    }
}

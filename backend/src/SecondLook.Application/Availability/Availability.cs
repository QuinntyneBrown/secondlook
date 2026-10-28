using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Availability;

public sealed record WindowDto(Guid Id, DateTimeOffset Start, DateTimeOffset End)
{
    public static WindowDto From(AvailabilityWindow w) => new(w.Id, w.StartUtc, w.EndUtc);
}

/// <summary>The caller's windows, or null when the caller is not an approved provider.</summary>
public sealed record GetAvailabilityQuery : IRequest<IReadOnlyList<WindowDto>?>;

public sealed class GetAvailabilityHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<GetAvailabilityQuery, IReadOnlyList<WindowDto>?>
{
    public async Task<IReadOnlyList<WindowDto>?> Handle(GetAvailabilityQuery q, CancellationToken ct)
    {
        var provider = await db.Users.FirstOrDefaultAsync(u => u.Id == caller.Id, ct);
        if (provider is null || !provider.CanTakeInspections) return null;
        var rows = await db.AvailabilityWindows.Where(w => w.ProviderId == caller.Id).ToListAsync(ct);
        return rows.OrderBy(w => w.StartUtc).Select(WindowDto.From).ToList();
    }
}

public abstract record WindowResult
{
    public sealed record Saved(WindowDto Window, bool Created) : WindowResult;
    public sealed record Removed : WindowResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : WindowResult;
    public sealed record Overlap : WindowResult;
    public sealed record Booked : WindowResult;
    public sealed record NotApproved : WindowResult;
    public sealed record NotFound : WindowResult;
}

internal static class WindowRules
{
    public static IReadOnlyDictionary<string, string[]>? Validate(DateTimeOffset start, DateTimeOffset end, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string[]>();
        if (start <= now) errors["start"] = ["Choose a start time in the future."];
        else if (start.Minute % 30 != 0 || start.Second != 0 || start.Millisecond != 0)
            errors["start"] = ["Start on the hour or half hour."];
        if (end <= start) errors["end"] = ["End must be after the start."];
        else if (end - start > AvailabilityWindow.MaxLength) errors["end"] = ["A window can be at most 12 hours."];
        else if (end.Minute % 30 != 0 || end.Second != 0 || end.Millisecond != 0)
            errors["end"] = ["End on the hour or half hour."];
        return errors.Count == 0 ? null : errors;
    }

    public static async Task<bool> HasActiveReservationAsync(IAppDbContext db, Guid providerId, DateTimeOffset start, DateTimeOffset end, DateTimeOffset now, CancellationToken ct)
    {
        var rows = await db.SlotReservations.Where(r => r.ProviderId == providerId && r.StartUtc >= start && r.StartUtc < end).ToListAsync(ct);
        return rows.Any(r => r.IsActive(now));
    }
}

public sealed record AddWindowCommand(DateTimeOffset Start, DateTimeOffset End) : IRequest<WindowResult>;

public sealed class AddWindowHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<AddWindowCommand, WindowResult>
{
    public async Task<WindowResult> Handle(AddWindowCommand c, CancellationToken ct)
    {
        var provider = await db.Users.FirstOrDefaultAsync(u => u.Id == caller.Id, ct);
        if (provider is null || !provider.CanTakeInspections) return new WindowResult.NotApproved();
        var start = c.Start.ToUniversalTime();
        var end = c.End.ToUniversalTime();
        if (WindowRules.Validate(start, end, clock.GetUtcNow()) is { } errors) return new WindowResult.Invalid(errors);

        var mine = await db.AvailabilityWindows.Where(w => w.ProviderId == caller.Id).ToListAsync(ct);
        if (mine.Any(w => w.Overlaps(start, end))) return new WindowResult.Overlap();

        var window = new AvailabilityWindow { Id = Guid.NewGuid(), ProviderId = caller.Id, StartUtc = start, EndUtc = end };
        db.AvailabilityWindows.Add(window);
        await db.SaveChangesAsync(ct);
        return new WindowResult.Saved(WindowDto.From(window), true);
    }
}

public sealed record UpdateWindowCommand(Guid Id, DateTimeOffset Start, DateTimeOffset End) : IRequest<WindowResult>;

public sealed class UpdateWindowHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<UpdateWindowCommand, WindowResult>
{
    public async Task<WindowResult> Handle(UpdateWindowCommand c, CancellationToken ct)
    {
        var provider = await db.Users.FirstOrDefaultAsync(u => u.Id == caller.Id, ct);
        if (provider is null || !provider.CanTakeInspections) return new WindowResult.NotApproved();
        var mine = await db.AvailabilityWindows.Where(w => w.ProviderId == caller.Id).ToListAsync(ct);
        var window = mine.FirstOrDefault(w => w.Id == c.Id);
        if (window is null) return new WindowResult.NotFound();

        var start = c.Start.ToUniversalTime();
        var end = c.End.ToUniversalTime();
        var now = clock.GetUtcNow();
        if (WindowRules.Validate(start, end, now) is { } errors) return new WindowResult.Invalid(errors);
        if (mine.Any(w => w.Id != window.Id && w.Overlaps(start, end))) return new WindowResult.Overlap();

        // The new span must still cover every active reservation the old one covered.
        var reservations = (await db.SlotReservations.Where(r => r.ProviderId == caller.Id && r.StartUtc >= window.StartUtc && r.StartUtc < window.EndUtc).ToListAsync(ct))
            .Where(r => r.IsActive(now));
        if (reservations.Any(r => r.StartUtc < start || r.StartUtc + AvailabilityWindow.SlotLength > end)) return new WindowResult.Booked();

        window.StartUtc = start;
        window.EndUtc = end;
        await db.SaveChangesAsync(ct);
        return new WindowResult.Saved(WindowDto.From(window), false);
    }
}

public sealed record RemoveWindowCommand(Guid Id) : IRequest<WindowResult>;

public sealed class RemoveWindowHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<RemoveWindowCommand, WindowResult>
{
    public async Task<WindowResult> Handle(RemoveWindowCommand c, CancellationToken ct)
    {
        var window = await db.AvailabilityWindows.FirstOrDefaultAsync(w => w.Id == c.Id && w.ProviderId == caller.Id, ct);
        if (window is null) return new WindowResult.NotFound();
        if (await WindowRules.HasActiveReservationAsync(db, caller.Id, window.StartUtc, window.EndUtc, clock.GetUtcNow(), ct)) return new WindowResult.Booked();
        db.AvailabilityWindows.Remove(window);
        await db.SaveChangesAsync(ct);
        return new WindowResult.Removed();
    }
}

public sealed record SlotDto(Guid ProviderId, string ProviderName, string Kind, DateTimeOffset Start, DateTimeOffset End);

public sealed record SlotsResult(string TimeZone, IReadOnlyList<SlotDto> Slots);

public sealed record ListSlotsQuery(DateTimeOffset? From, DateTimeOffset? To, string? Kind) : IRequest<SlotsResult>;

/// <summary>Free slots of providers who can take inspections: in the future, inside a window, with no active reservation (L2-061).</summary>
public sealed class ListSlotsHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<ListSlotsQuery, SlotsResult>
{
    public const string TimeZone = "America/Toronto";

    public async Task<SlotsResult> Handle(ListSlotsQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var from = q.From?.ToUniversalTime() ?? now;
        var to = q.To?.ToUniversalTime() ?? from.AddDays(14);
        var kind = Enum.TryParse<UserRole>(q.Kind, out var k) && k is UserRole.Mechanic or UserRole.BodyShop ? k : UserRole.Mechanic;

        var providers = (await db.Users.Where(u => u.Role == kind).ToListAsync(ct)).Where(u => u.CanTakeInspections).ToDictionary(u => u.Id);
        var windows = (await db.AvailabilityWindows.ToListAsync(ct)).Where(w => providers.ContainsKey(w.ProviderId) && w.EndUtc > from && w.StartUtc < to);
        var taken = (await db.SlotReservations.ToListAsync(ct)).Where(r => r.IsActive(now)).Select(r => (r.ProviderId, r.StartUtc)).ToHashSet();

        var slots = windows
            .SelectMany(w => w.SlotStarts().Select(s => (w.ProviderId, Start: s)))
            .Where(s => s.Start > now && s.Start >= from && s.Start < to && !taken.Contains((s.ProviderId, s.Start)))
            .OrderBy(s => s.Start).ThenBy(s => providers[s.ProviderId].DisplayName)
            .Select(s => new SlotDto(s.ProviderId, providers[s.ProviderId].DisplayName, providers[s.ProviderId].Role.ToString(), s.Start, s.Start + AvailabilityWindow.SlotLength))
            .ToList();
        return new SlotsResult(TimeZone, slots);
    }
}

public sealed record ReserveSlotCommand(Guid ProviderId, DateTimeOffset Start, ReservationStatus Status, TimeSpan? HoldFor) : IRequest<ReserveSlotResult>;

public abstract record ReserveSlotResult
{
    public sealed record Reserved(Guid ReservationId) : ReserveSlotResult;
    public sealed record Taken : ReserveSlotResult;
    public sealed record NotAvailable : ReserveSlotResult;
}

/// <summary>
/// Takes one slot. The booking journeys call this; a concurrent loser of the unique-index race, or any
/// request for an already reserved slot, gets <see cref="ReserveSlotResult.Taken"/>.
/// </summary>
public sealed class ReserveSlotHandler(IAppDbContext db, TimeProvider clock) : IRequestHandler<ReserveSlotCommand, ReserveSlotResult>
{
    public async Task<ReserveSlotResult> Handle(ReserveSlotCommand c, CancellationToken ct)
    {
        var start = c.Start.ToUniversalTime();
        var provider = await db.Users.FirstOrDefaultAsync(u => u.Id == c.ProviderId, ct);
        if (provider is null || !provider.CanTakeInspections) return new ReserveSlotResult.NotAvailable();
        var windows = await db.AvailabilityWindows.Where(w => w.ProviderId == c.ProviderId).ToListAsync(ct);
        var now = clock.GetUtcNow();
        if (start <= now || !windows.Any(w => w.SlotStarts().Contains(start))) return new ReserveSlotResult.NotAvailable();

        for (var attempt = 0; attempt < 6; attempt++)
        {
            var existing = await db.SlotReservations.Where(r => r.ProviderId == c.ProviderId && r.StartUtc == start).ToListAsync(ct);
            if (existing.Any(r => r.IsActive(now))) return new ReserveSlotResult.Taken();
            foreach (var stale in existing) db.SlotReservations.Remove(stale); // an expired hold frees the slot

            var reservation = new SlotReservation
            {
                Id = Guid.NewGuid(),
                ProviderId = c.ProviderId,
                StartUtc = start,
                Status = c.Status,
                ExpiresAt = c.Status == ReservationStatus.Held ? now + (c.HoldFor ?? TimeSpan.FromMinutes(10)) : null,
            };
            db.SlotReservations.Add(reservation);
            try
            {
                await db.SaveChangesAsync(ct);
                return new ReserveSlotResult.Reserved(reservation.Id);
            }
            catch (DbUpdateException)
            {
                // Lost the race (unique index) or the database was briefly busy: look again.
                db.ChangeTracker.Clear();
                await Task.Delay(20 * (attempt + 1), ct);
            }
        }
        return new ReserveSlotResult.Taken();
    }
}

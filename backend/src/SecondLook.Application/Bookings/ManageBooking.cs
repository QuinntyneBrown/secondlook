using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Availability;
using SecondLook.Application.Payments;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Inspections;

namespace SecondLook.Application.Bookings;

public sealed record RescheduleSlotsQuery(Guid InspectionId) : IRequest<IReadOnlyList<SlotDto>?>;

/// <summary>The inspection's own mechanic's free slots (ADR 0009); null when the inspection is not the caller's.</summary>
public sealed class RescheduleSlotsHandler(IAppDbContext db, ICurrentUser caller, IMediator mediator, TimeProvider clock) : IRequestHandler<RescheduleSlotsQuery, IReadOnlyList<SlotDto>?>
{
    public async Task<IReadOnlyList<SlotDto>?> Handle(RescheduleSlotsQuery q, CancellationToken ct)
    {
        var inspection = await db.Inspections.ForBuyer(caller).FirstOrDefaultAsync(i => i.Id == q.InspectionId, ct);
        if (inspection is null) return null;
        // Within two weeks either side of the current call, and never in the past.
        var from = inspection.StartUtc.AddDays(-14);
        var now = clock.GetUtcNow();
        var all = await mediator.Send(new ListSlotsQuery(from > now ? from : now, inspection.StartUtc.AddDays(14), "Mechanic"), ct);
        return all.Slots.Where(s => s.ProviderId == inspection.MechanicId).ToList();
    }
}

public abstract record ChangeResult
{
    public sealed record Done(InspectionDto Inspection) : ChangeResult;
    public sealed record NotFound : ChangeResult;
    /// <summary>The inspection is cancelled or its call has started.</summary>
    public sealed record NotAllowed : ChangeResult;
    public sealed record SlotUnavailable : ChangeResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : ChangeResult;
}

public sealed record RescheduleInspectionCommand(Guid InspectionId, DateTimeOffset Start) : IRequest<ChangeResult>;

/// <summary>Books the new slot first, then moves the inspection with a conditional update, then frees the old slot (ADR 0009).</summary>
public sealed class RescheduleInspectionHandler(IAppDbContext db, ICurrentUser caller, IMediator mediator, TimeProvider clock) : IRequestHandler<RescheduleInspectionCommand, ChangeResult>
{
    public async Task<ChangeResult> Handle(RescheduleInspectionCommand c, CancellationToken ct)
    {
        var inspection = await db.Inspections.ForBuyer(caller).FirstOrDefaultAsync(i => i.Id == c.InspectionId, ct);
        if (inspection is null) return new ChangeResult.NotFound();
        var now = clock.GetUtcNow();
        if (inspection.Status != InspectionStatus.Scheduled || inspection.StartUtc <= now) return new ChangeResult.NotAllowed();

        var start = c.Start.ToUniversalTime();
        if (start == inspection.StartUtc) return new ChangeResult.Done(await InspectionMapper.ToDtoAsync(db, clock, inspection, ct));
        var oldReservation = inspection.SlotReservationId;
        var id = inspection.Id;

        var reserved = await mediator.Send(new ReserveSlotCommand(inspection.MechanicId!.Value, start, ReservationStatus.Booked, null, caller.Id), ct);
        if (reserved is not ReserveSlotResult.Reserved r) return new ChangeResult.SlotUnavailable();

        var end = start + AvailabilityWindow.SlotLength;
        var moved = await db.Inspections
            .Where(i => i.Id == id && i.Status == InspectionStatus.Scheduled && i.SlotReservationId == oldReservation)
            .ExecuteUpdateAsync(set => set.SetProperty(i => i.StartUtc, start).SetProperty(i => i.EndUtc, end).SetProperty(i => i.SlotReservationId, r.ReservationId), ct);

        db.ChangeTracker.Clear();
        if (moved == 0)
        {
            // The inspection changed meanwhile (cancelled or moved elsewhere): give back the slot taken for this attempt.
            await db.SlotReservations.Where(x => x.Id == r.ReservationId).ExecuteDeleteAsync(ct);
            return new ChangeResult.NotAllowed();
        }
        await db.SlotReservations.Where(x => x.Id == oldReservation).ExecuteDeleteAsync(ct);
        var fresh = await db.Inspections.FirstAsync(i => i.Id == id, ct);
        return new ChangeResult.Done(await InspectionMapper.ToDtoAsync(db, clock, fresh, ct));
    }
}

public sealed record CancelInspectionCommand(Guid InspectionId, string? Reason) : IRequest<ChangeResult>;

/// <summary>
/// Cancels once: a conditional update picks the single winner, who releases the slot and refunds through the
/// payment contract; a repeated or simultaneous request returns the cancelled inspection and refunds nothing more.
/// </summary>
public sealed class CancelInspectionHandler(IAppDbContext db, ICurrentUser caller, IMediator mediator, TimeProvider clock) : IRequestHandler<CancelInspectionCommand, ChangeResult>
{
    public async Task<ChangeResult> Handle(CancelInspectionCommand c, CancellationToken ct)
    {
        if (!Enum.TryParse<CancelReason>(c.Reason, out var reason) || !Enum.IsDefined(reason))
            return new ChangeResult.Invalid(new Dictionary<string, string[]> { ["reason"] = ["Choose a reason so we can improve."] });

        var inspection = await db.Inspections.ForBuyer(caller).FirstOrDefaultAsync(i => i.Id == c.InspectionId, ct);
        if (inspection is null) return new ChangeResult.NotFound();
        var id = inspection.Id;
        var now = clock.GetUtcNow();

        if (inspection.Status == InspectionStatus.Cancelled) return await Settled(id, ct);
        if (inspection.StartUtc <= now) return new ChangeResult.NotAllowed();

        var hoursBefore = (int)Math.Floor((inspection.StartUtc - now).TotalHours);
        var paymentId = inspection.PaymentId;
        var reservation = inspection.SlotReservationId;
        var won = await db.Inspections
            .Where(i => i.Id == id && i.Status == InspectionStatus.Scheduled)
            .ExecuteUpdateAsync(set => set.SetProperty(i => i.Status, InspectionStatus.Cancelled).SetProperty(i => i.CancelledAt, now).SetProperty(i => i.CancelReason, reason), ct);
        db.ChangeTracker.Clear();
        if (won == 0) return await Settled(id, ct);

        await db.SlotReservations.Where(r => r.Id == reservation).ExecuteDeleteAsync(ct);
        var refund = await mediator.Send(new RefundPaymentCommand(paymentId, RefundReason.BuyerCancelled, hoursBefore, false), ct);
        var (refunded, retained) = refund is RefundResult.Refunded rr ? (rr.AmountCents, rr.RetainedCents) : (0, 0);
        await db.Inspections.Where(i => i.Id == id)
            .ExecuteUpdateAsync(set => set.SetProperty(i => i.RefundedCents, refunded).SetProperty(i => i.RetainedCents, retained).SetProperty(i => i.RefundSettled, true), ct);
        return await Settled(id, ct);
    }

    /// <summary>The cancelled inspection, once the winning request has recorded its refund.</summary>
    private async Task<ChangeResult> Settled(Guid id, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 60; attempt++)
        {
            db.ChangeTracker.Clear();
            var i = await db.Inspections.FirstAsync(x => x.Id == id, ct);
            if (i.RefundSettled || attempt == 59) return new ChangeResult.Done(await InspectionMapper.ToDtoAsync(db, clock, i, ct));
            await Task.Delay(50, ct);
        }
        throw new InvalidOperationException("Unreachable.");
    }
}

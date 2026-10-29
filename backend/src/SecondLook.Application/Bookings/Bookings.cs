using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Availability;
using SecondLook.Application.Payments;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Bookings;

public sealed record HoldDto(Guid HoldId, Guid ProviderId, string ProviderName, DateTimeOffset Start, DateTimeOffset End, DateTimeOffset ExpiresAt, Guid? BodyShopHoldId = null, string? BodyShopName = null);

public abstract record HoldResult
{
    public sealed record Held(HoldDto Hold) : HoldResult;
    public sealed record Taken : HoldResult;
}

public sealed record HoldSlotCommand(Guid ProviderId, DateTimeOffset Start, Guid? BodyShopId = null) : IRequest<HoldResult>;

/// <summary>Takes a slot for 10 minutes. A buyer has one active hold: a new one releases the old (ADR 0008).</summary>
public sealed class HoldSlotHandler(IAppDbContext db, ICurrentUser caller, IMediator mediator, TimeProvider clock) : IRequestHandler<HoldSlotCommand, HoldResult>
{
    public static readonly TimeSpan HoldFor = TimeSpan.FromMinutes(10);

    public async Task<HoldResult> Handle(HoldSlotCommand c, CancellationToken ct)
    {
        var start = c.Start.ToUniversalTime();
        var result = await mediator.Send(new ReserveSlotCommand(c.ProviderId, start, ReservationStatus.Held, HoldFor, caller.Id), ct);
        if (result is not ReserveSlotResult.Reserved reserved) return new HoldResult.Taken();

        // A combined call holds the body shop's slot too, all or nothing (ADR 0011).
        Guid? shopHold = null;
        if (c.BodyShopId is { } shopId)
        {
            var shop = await mediator.Send(new ReserveSlotCommand(shopId, start, ReservationStatus.Held, HoldFor, caller.Id), ct);
            if (shop is not ReserveSlotResult.Reserved sr)
            {
                await db.SlotReservations.Where(r => r.Id == reserved.ReservationId).ExecuteDeleteAsync(ct);
                db.ChangeTracker.Clear();
                return new HoldResult.Taken();
            }
            shopHold = sr.ReservationId;
        }

        // Release the buyer's earlier holds only once the new one is secured.
        var release = await db.SlotReservations.Where(r => r.BuyerId == caller.Id && r.Status == ReservationStatus.Held && r.Id != reserved.ReservationId && r.Id != shopHold).ToListAsync(ct);
        foreach (var r in release) db.SlotReservations.Remove(r);
        if (release.Count > 0) await db.SaveChangesAsync(ct);

        var provider = await db.Users.FirstAsync(u => u.Id == c.ProviderId, ct);
        var expires = clock.GetUtcNow() + HoldFor;
        var shopName = c.BodyShopId is { } sid ? (await db.Users.FirstAsync(u => u.Id == sid, ct)).DisplayName : null;
        return new HoldResult.Held(new HoldDto(reserved.ReservationId, c.ProviderId, provider.DisplayName, start, start + AvailabilityWindow.SlotLength, expires, shopHold, shopName));
    }
}

public sealed record VehicleCopyDto(int Year, string Make, string Model, string? Vin, int OdometerKm, decimal AskingPrice, string? ListingUrl, string SellerName, string SellerPhone);

public sealed record InspectionDto(
    Guid Id, string Status, DateTimeOffset Start, DateTimeOffset End, string? MechanicName, string? BodyShopName, string Review, int AmountCents, VehicleCopyDto Vehicle, DateTimeOffset CreatedAt,
    string? CardLast4, int RefundPreviewCents, DateTimeOffset? CancelledAt, int RefundedCents, int RetainedCents, bool CanChange);

internal static class InspectionMapper
{
    /// <summary>What cancelling now would refund: everything more than 2 hours before the call, otherwise minus the $25 fee.</summary>
    public static int RefundPreview(Inspection i, DateTimeOffset now) =>
        i.Status != InspectionStatus.Scheduled ? 0
        : (i.StartUtc - now) >= TimeSpan.FromHours(2) ? i.AmountCents
        : i.AmountCents - Math.Min(RefundPaymentHandler.RetainedCents, i.AmountCents);

    public static async Task<InspectionDto> ToDtoAsync(IAppDbContext db, TimeProvider clock, Inspection i, CancellationToken ct)
    {
        var mechanic = i.MechanicId is { } id ? (await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct))?.DisplayName : null;
        var shop = i.BodyShopId is { } sid ? (await db.Users.FirstOrDefaultAsync(u => u.Id == sid, ct))?.DisplayName : null;
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == i.PaymentId, ct);
        var now = clock.GetUtcNow();
        return new InspectionDto(i.Id, i.Status.ToString(), i.StartUtc, i.EndUtc, mechanic, shop, i.Review.ToString(), i.AmountCents,
            new VehicleCopyDto(i.Year, i.Make, i.Model, i.Vin, i.OdometerKm, i.AskingPrice, i.ListingUrl, i.SellerName, i.SellerPhone), i.CreatedAt,
            payment?.CardLast4, RefundPreview(i, now), i.CancelledAt, i.RefundedCents, i.RetainedCents,
            i.Status == InspectionStatus.Scheduled && i.StartUtc > now);
    }
}

public abstract record ConfirmResult
{
    public sealed record Created(InspectionDto Inspection) : ConfirmResult;
    public sealed record Existing(InspectionDto Inspection) : ConfirmResult;
    public sealed record NotFound : ConfirmResult;
    public sealed record PaymentRequired : ConfirmResult;
    public sealed record SlotLost(bool Refunded) : ConfirmResult;
    /// <summary>The holds do not fit the paid review (ADR 0011); nothing is refunded and the buyer can pick again.</summary>
    public sealed record HoldMismatch : ConfirmResult;
}

public sealed record ConfirmBookingCommand(Guid CheckoutId, Guid HoldId, Guid VehicleId, Guid? BodyShopHoldId = null) : IRequest<ConfirmResult>;

/// <summary>Turns a paid checkout, a hold and a saved vehicle into exactly one inspection (ADR 0008).</summary>
public sealed class ConfirmBookingHandler(IAppDbContext db, ICurrentUser caller, IMediator mediator, TimeProvider clock) : IRequestHandler<ConfirmBookingCommand, ConfirmResult>
{
    public async Task<ConfirmResult> Handle(ConfirmBookingCommand c, CancellationToken ct)
    {
        // A concurrent request that confirms the same checkout first (unique index) or a briefly busy database
        // makes the save fail; looking again returns the winner's inspection (L2-029).
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                return await ConfirmOnce(c, ct);
            }
            catch (DbUpdateException) when (attempt < 6)
            {
                db.ChangeTracker.Clear();
                await Task.Delay(40 * (attempt + 1), ct);
            }
        }
    }

    private async Task<ConfirmResult> ConfirmOnce(ConfirmBookingCommand c, CancellationToken ct)
    {
        var checkout = await db.Checkouts.ForBuyer(caller).FirstOrDefaultAsync(x => x.Id == c.CheckoutId, ct);
        if (checkout is null) return new ConfirmResult.NotFound();

        var existing = await db.Inspections.FirstOrDefaultAsync(i => i.CheckoutId == checkout.Id, ct);
        if (existing is not null) return new ConfirmResult.Existing(await InspectionMapper.ToDtoAsync(db, clock, existing, ct));

        var vehicle = await db.Vehicles.ForBuyer(caller).FirstOrDefaultAsync(v => v.Id == c.VehicleId && v.RemovedAt == null, ct);
        if (vehicle is null) return new ConfirmResult.NotFound();
        var anyHold = await db.SlotReservations.FirstOrDefaultAsync(r => r.Id == c.HoldId, ct);
        if (anyHold is not null && anyHold.BuyerId != caller.Id) return new ConfirmResult.NotFound();
        var shopHold = c.BodyShopHoldId is { } shopHoldId ? await db.SlotReservations.FirstOrDefaultAsync(r => r.Id == shopHoldId, ct) : null;
        if (shopHold is not null && shopHold.BuyerId != caller.Id) return new ConfirmResult.NotFound();
        if (checkout.Status != CheckoutStatus.Paid) return new ConfirmResult.PaymentRequired();
        var payment = await db.Payments.FirstAsync(p => p.CheckoutId == checkout.Id, ct);

        // The holds must fit the paid review: a mechanic, a body shop, or one of each for a combined call (ADR 0011).
        var holder = anyHold is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Id == anyHold.ProviderId, ct);
        var wantsShop = checkout.Review == ReviewType.Both;
        var expectedRole = checkout.Review == ReviewType.BodyShop ? UserRole.BodyShop : UserRole.Mechanic;
        if ((holder is not null && holder.Role != expectedRole) || (c.BodyShopHoldId is not null) != wantsShop) return new ConfirmResult.HoldMismatch();

        // The hold row is gone when someone else took the slot after it expired: refund in full and say so.
        if (anyHold is null || anyHold.Status == ReservationStatus.Booked || (wantsShop && (shopHold is null || shopHold.Status == ReservationStatus.Booked)))
        {
            // A concurrent request may have booked this very checkout a moment ago; never refund a booking that exists.
            var winner = await db.Inspections.FirstOrDefaultAsync(i => i.CheckoutId == checkout.Id, ct);
            if (winner is not null) return new ConfirmResult.Existing(await InspectionMapper.ToDtoAsync(db, clock, winner, ct));
            var refund = await mediator.Send(new RefundPaymentCommand(payment.Id, RefundReason.SlotUnavailable, null, false), ct);
            return new ConfirmResult.SlotLost(refund is RefundResult.Refunded);
        }

        var now = clock.GetUtcNow();
        anyHold.Status = ReservationStatus.Booked;
        anyHold.ExpiresAt = null;
        if (shopHold is not null)
        {
            shopHold.Status = ReservationStatus.Booked;
            shopHold.ExpiresAt = null;
        }
        var inspection = new Inspection
        {
            Id = Guid.NewGuid(), BuyerId = caller.Id,
            MechanicId = checkout.Review == ReviewType.BodyShop ? null : anyHold.ProviderId,
            BodyShopId = checkout.Review == ReviewType.BodyShop ? anyHold.ProviderId : shopHold?.ProviderId,
            BodyShopReservationId = shopHold?.Id, CheckoutId = checkout.Id, PaymentId = payment.Id,
            SlotReservationId = anyHold.Id, Review = checkout.Review, StartUtc = anyHold.StartUtc, EndUtc = anyHold.StartUtc + AvailabilityWindow.SlotLength,
            AmountCents = payment.AmountCents, CreatedAt = now,
            Year = vehicle.Year, Make = vehicle.Make, Model = vehicle.Model, Vin = vehicle.Vin, OdometerKm = vehicle.OdometerKm, AskingPrice = vehicle.AskingPrice, ListingUrl = vehicle.ListingUrl,
            SellerName = vehicle.SellerName, SellerPhone = vehicle.SellerPhone,
        };
        db.Inspections.Add(inspection);
        await db.SaveChangesAsync(ct);
        return new ConfirmResult.Created(await InspectionMapper.ToDtoAsync(db, clock, inspection, ct));
    }
}

public sealed record ListInspectionsQuery : IRequest<IReadOnlyList<InspectionDto>>;

public sealed class ListInspectionsHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<ListInspectionsQuery, IReadOnlyList<InspectionDto>>
{
    public async Task<IReadOnlyList<InspectionDto>> Handle(ListInspectionsQuery q, CancellationToken ct)
    {
        var rows = (await db.Inspections.ForCaller(caller).ToListAsync(ct)).OrderBy(i => i.StartUtc).ToList();
        var list = new List<InspectionDto>();
        foreach (var i in rows) list.Add(await InspectionMapper.ToDtoAsync(db, clock, i, ct));
        return list;
    }
}

public sealed record GetInspectionQuery(Guid Id) : IRequest<InspectionDto?>;

public sealed class GetInspectionHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<GetInspectionQuery, InspectionDto?>
{
    public async Task<InspectionDto?> Handle(GetInspectionQuery q, CancellationToken ct)
    {
        var i = await db.Inspections.ForCaller(caller).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return i is null ? null : await InspectionMapper.ToDtoAsync(db, clock, i, ct);
    }
}

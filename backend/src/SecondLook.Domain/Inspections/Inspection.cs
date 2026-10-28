using SecondLook.Domain.Payments;
using SecondLook.Domain.Scoping;

namespace SecondLook.Domain.Inspections;

public enum InspectionStatus
{
    Scheduled = 1,
    Cancelled = 2,
}

public enum CancelReason
{
    DifferentCar = 1,
    SellerBackedOut = 2,
    PriceChanged = 3,
    Other = 4,
}

/// <summary>
/// A confirmed video inspection. It owns a copy of the vehicle details taken at booking time, so later edits or
/// removal of the saved vehicle never change it (ADR 0006, 0008).
/// </summary>
public sealed class Inspection : IBuyerOwned, IProviderAssigned
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public Guid? MechanicId { get; set; }
    public Guid? BodyShopId { get; set; }
    public Guid CheckoutId { get; set; }
    public Guid PaymentId { get; set; }
    public Guid SlotReservationId { get; set; }
    public InspectionStatus Status { get; set; } = InspectionStatus.Scheduled;
    public ReviewType Review { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset EndUtc { get; set; }
    public int AmountCents { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? CancelledAt { get; set; }
    public CancelReason? CancelReason { get; set; }
    public int RefundedCents { get; set; }
    public int RetainedCents { get; set; }

    /// <summary>True once the refund of a cancellation has been recorded, so a repeated request can wait for it.</summary>
    public bool RefundSettled { get; set; }

    public string Vin { get; set; } = "";
    public int OdometerKm { get; set; }
    public decimal AskingPrice { get; set; }
    public string? ListingUrl { get; set; }
    public string SellerName { get; set; } = "";
    public string SellerPhone { get; set; } = "";
}

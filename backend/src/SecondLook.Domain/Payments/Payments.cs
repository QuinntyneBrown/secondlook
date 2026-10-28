using SecondLook.Domain.Scoping;

namespace SecondLook.Domain.Payments;

public enum ReviewType
{
    Mechanic = 1,
    BodyShop = 2,
    Both = 3,
}

public enum CheckoutStatus
{
    Pending = 1,
    Paid = 2,
}

public sealed record QuoteLine(string Label, int Cents);

public sealed record PriceQuote(IReadOnlyList<QuoteLine> Lines)
{
    public int TotalCents => Lines.Sum(l => l.Cents);
}

/// <summary>The one place prices are decided (ADR 0007). Quotes and charges both come from here.</summary>
public static class PriceCalculator
{
    public const int FirstInspectionCents = 5000;
    public const int AdditionalVehicleCents = 2500;
    public const int BothReviewsCents = 2000;
    public static readonly TimeSpan WindowLength = TimeSpan.FromDays(14);

    public static PriceQuote Quote(ReviewType review, bool windowOpen)
    {
        var lines = new List<QuoteLine>
        {
            windowOpen
                ? new QuoteLine("Additional vehicle", AdditionalVehicleCents)
                : new QuoteLine(review == ReviewType.BodyShop ? "Body shop review" : "Mechanic review", FirstInspectionCents),
        };
        if (review == ReviewType.Both) lines.Add(new QuoteLine("Body shop review add-on", BothReviewsCents));
        return new PriceQuote(lines);
    }

    /// <summary>What a receipt says was bought, e.g. "additional vehicle + body shop".</summary>
    public static string Describe(ReviewType review, bool additional) =>
        (additional ? "additional vehicle" : "first inspection") + review switch
        {
            ReviewType.Both => " + body shop",
            ReviewType.BodyShop => " (body shop review)",
            _ => "",
        };
}

/// <summary>A buyer's 14-day pricing window; it opens when their first payment succeeds.</summary>
public sealed class PricingWindow : IBuyerOwned
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }

    public bool IsOpen(DateTimeOffset now) => StartsAt <= now && now < EndsAt;
}

/// <summary>A pending or paid purchase of an inspection. The booking journeys attach the slot and confirm it.</summary>
public sealed class Checkout : IBuyerOwned
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public ReviewType Review { get; set; }
    public Guid? VehicleId { get; set; }
    public string IdempotencyKey { get; set; } = "";
    public CheckoutStatus Status { get; set; } = CheckoutStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>A successful charge. Only the card brand and last four digits are kept, never the card number (ADR 0007).</summary>
public sealed class Payment : IBuyerOwned
{
    public Guid Id { get; set; }
    public Guid CheckoutId { get; set; }
    public Guid BuyerId { get; set; }
    public int AmountCents { get; set; }
    public string Description { get; set; } = "";
    public string CardBrand { get; set; } = "";
    public string CardLast4 { get; set; } = "";
    public string ProcessorReference { get; set; } = "";
    public DateTimeOffset PaidAt { get; set; }
    public int RefundedCents { get; set; }
    public DateTimeOffset? RefundedAt { get; set; }

    public string Status => RefundedCents <= 0 ? "Paid" : RefundedCents >= AmountCents ? "Refunded" : "Partially refunded";
}

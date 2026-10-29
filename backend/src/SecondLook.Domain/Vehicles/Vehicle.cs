using SecondLook.Domain.Scoping;

namespace SecondLook.Domain.Vehicles;

/// <summary>A vehicle a buyer saved. Removal is soft (ADR 0006): <see cref="RemovedAt"/> hides it from the list.</summary>
public sealed class Vehicle : IBuyerOwned
{
    public Guid Id { get; set; }
    public Guid BuyerId { get; set; }
    public int Year { get; set; }
    public string Make { get; set; } = "";
    public string Model { get; set; } = "";

    /// <summary>Optional (ADR 0018); null when the buyer did not give one.</summary>
    public string? Vin { get; set; }
    public int OdometerKm { get; set; }
    public decimal AskingPrice { get; set; }
    public string? ListingUrl { get; set; }
    public string SellerName { get; set; } = "";
    public string SellerPhone { get; set; } = "";
    public DateTimeOffset? RemovedAt { get; set; }

    public bool IsSaved => RemovedAt is null;
}

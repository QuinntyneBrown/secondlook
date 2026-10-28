namespace SecondLook.Domain.Availability;

/// <summary>A span of time, in UTC, during which one provider can take inspections (ADR 0005).</summary>
public sealed class AvailabilityWindow
{
    public static readonly TimeSpan SlotLength = TimeSpan.FromMinutes(30);
    public static readonly TimeSpan MaxLength = TimeSpan.FromHours(12);

    public Guid Id { get; set; }
    public Guid ProviderId { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset EndUtc { get; set; }

    public bool Overlaps(DateTimeOffset start, DateTimeOffset end) => StartUtc < end && start < EndUtc;

    /// <summary>Consecutive 30-minute slot starts from the window start; a slot that would run past the end is dropped.</summary>
    public IEnumerable<DateTimeOffset> SlotStarts()
    {
        for (var s = StartUtc; s + SlotLength <= EndUtc; s += SlotLength) yield return s;
    }
}

public enum ReservationStatus
{
    Held = 1,
    Booked = 2,
}

/// <summary>
/// A slot taken by a booking, or held for a buyer who has not finished paying. A unique index on
/// (ProviderId, StartUtc) makes double-booking impossible even under concurrent requests.
/// </summary>
public sealed class SlotReservation
{
    public Guid Id { get; set; }
    public Guid ProviderId { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public ReservationStatus Status { get; set; }

    /// <summary>The buyer who holds or booked the slot (null for reservations made without a buyer).</summary>
    public Guid? BuyerId { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }

    public bool IsActive(DateTimeOffset now) => Status == ReservationStatus.Booked || (ExpiresAt is { } e && e > now);
}

namespace SecondLook.Domain.Calls;

/// <summary>The live video call of one inspection, created by the first participant to join (ADR 0012).</summary>
public sealed class CallSession
{
    /// <summary>The fixed inspection checklist, in order (L2-041).</summary>
    public static readonly string[] Checklist = ["Brakes", "Tires", "Suspension", "Steering", "Lights, horn, wipers", "Body panels"];

    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public Guid? EndedByUserId { get; set; }

    /// <summary>The item being inspected now; items before it are done. Equal to the item count when all are done.</summary>
    public int ChecklistIndex { get; set; }
}

/// <summary>A note the mechanic added during the call, shown to the others as "Notes from ...".</summary>
public sealed class CallNote
{
    public Guid Id { get; set; }
    public Guid CallSessionId { get; set; }
    public Guid AuthorId { get; set; }
    public string AuthorName { get; set; } = "";
    public string Text { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

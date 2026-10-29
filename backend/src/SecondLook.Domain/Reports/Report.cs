namespace SecondLook.Domain.Reports;

public enum FindingStatus
{
    Required = 1,
    Recommended = 2,
    Passes = 3,
}

/// <summary>Who wrote a finding: the report keeps the mechanic's and the body shop's findings apart (ADR 0014).</summary>
public enum FindingSource
{
    Mechanic = 1,
    BodyShop = 2,
}

public enum IssueReason
{
    FindingLooksWrong = 1,
    SomethingMissed = 2,
    CostSeemsOff = 3,
    SomethingElse = 4,
}

/// <summary>
/// The report of an inspection (ADR 0013, 0014). It has two parts with their own author and their own completion: the
/// mechanic's estimate and the body shop's findings. The report exists from the first part submitted, so a part that is not
/// delivered yet has a null time. Submitting a part again replaces that part's findings only.
/// </summary>
public sealed class Report
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public Guid? MechanicId { get; set; }
    public DateTimeOffset? MechanicSubmittedAt { get; set; }
    public Guid? BodyShopId { get; set; }
    public DateTimeOffset? BodyShopSubmittedAt { get; set; }
}

public sealed class ReportFinding
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public int Position { get; set; }
    public string Title { get; set; } = "";
    public string Note { get; set; } = "";
    public FindingStatus Status { get; set; }
    public FindingSource Source { get; set; } = FindingSource.Mechanic;

    /// <summary>The repair cost range in cents; both are null when there is no cost.</summary>
    public int? MinCents { get; set; }
    public int? MaxCents { get; set; }
}

/// <summary>A link that lets anyone read the report without an account, for 14 days or until the buyer turns it off.</summary>
public sealed class ReportShare
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public string Token { get; set; } = "";
    public bool IncludeBodyShop { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
}

/// <summary>The buyer asking the mechanic to take another look.</summary>
public sealed class ReportIssue
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public Guid ReporterId { get; set; }
    public IssueReason Reason { get; set; }
    public string Details { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

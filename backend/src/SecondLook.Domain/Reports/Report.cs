namespace SecondLook.Domain.Reports;

public enum FindingStatus
{
    Required = 1,
    Recommended = 2,
    Passes = 3,
}

public enum IssueReason
{
    FindingLooksWrong = 1,
    SomethingMissed = 2,
    CostSeemsOff = 3,
    SomethingElse = 4,
}

/// <summary>
/// The safety certification estimate the assigned mechanic writes after the call (ADR 0013). There is one per
/// inspection; submitting again replaces its findings.
/// </summary>
public sealed class Report
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public Guid MechanicId { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
}

public sealed class ReportFinding
{
    public Guid Id { get; set; }
    public Guid ReportId { get; set; }
    public int Position { get; set; }
    public string Title { get; set; } = "";
    public string Note { get; set; } = "";
    public FindingStatus Status { get; set; }

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

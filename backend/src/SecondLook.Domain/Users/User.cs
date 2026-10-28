namespace SecondLook.Domain.Users;

public enum ApprovalStatus
{
    Pending = 1,
    Approved = 2,
    Deactivated = 3,
}

public sealed class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public string? PasswordHash { get; set; }
    public bool EmailVerified { get; set; }

    /// <summary>Buyers and administrators are approved on creation; mechanics and body shops wait for an administrator (L2-064, ADR 0004).</summary>
    public ApprovalStatus ApprovalStatus { get; set; } = ApprovalStatus.Approved;

    public string? LicenceNumber { get; set; }
    public string? Location { get; set; }

    public bool IsProvider => Role is UserRole.Mechanic or UserRole.BodyShop;

    public bool IsApproved => ApprovalStatus == ApprovalStatus.Approved;

    /// <summary>Only an active, approved provider may be offered or assigned new inspections.</summary>
    public bool CanTakeInspections => IsProvider && IsActive && IsApproved;

    /// <summary>Pending or deactivated providers become approved (approval, or reactivation); false when no change is allowed.</summary>
    public bool Approve()
    {
        if (!IsProvider || ApprovalStatus == ApprovalStatus.Approved) return false;
        ApprovalStatus = ApprovalStatus.Approved;
        return true;
    }

    /// <summary>Only an approved provider can be deactivated; existing assignments are kept (ADR 0004).</summary>
    public bool Deactivate()
    {
        if (!IsProvider || ApprovalStatus != ApprovalStatus.Approved) return false;
        ApprovalStatus = ApprovalStatus.Deactivated;
        return true;
    }
}

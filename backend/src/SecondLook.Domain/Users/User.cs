namespace SecondLook.Domain.Users;

public sealed class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
    public string? PasswordHash { get; set; }
    public bool EmailVerified { get; set; }

    /// <summary>Buyers and administrators are approved on creation; mechanics and body shops wait for an administrator (L2-064).</summary>
    public bool IsApproved { get; set; } = true;
}

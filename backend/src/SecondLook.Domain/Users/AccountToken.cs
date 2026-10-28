namespace SecondLook.Domain.Users;

/// <summary>A single-use link token (email verification, password reset). Only its hash is stored.</summary>
public sealed class AccountToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Purpose { get; set; } = "";
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? UsedAt { get; set; }
}

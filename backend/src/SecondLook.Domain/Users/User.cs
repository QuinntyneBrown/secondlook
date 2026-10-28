namespace SecondLook.Domain.Users;

public sealed class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
}

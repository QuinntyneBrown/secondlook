using Microsoft.EntityFrameworkCore;
using SecondLook.Domain.Users;

namespace SecondLook.Infrastructure.Persistence;

/// <summary>Synthetic identities for local, e2e and demo hosts. Safe to re-run.</summary>
public static class PlatformSeeder
{
    /// <summary>Synthetic, public password of the seeded local identities. Never used outside local, test and demo hosts.</summary>
    public const string SyntheticPassword = "Password-123!";

    public static readonly (Guid Id, string Email, string Name, UserRole Role)[] Identities =
    [
        (Guid.Parse("00000000-0000-0000-0000-000000000b01"), "buyer@example.test", "Sam Buyer", UserRole.Buyer),
        (Guid.Parse("00000000-0000-0000-0000-000000000c01"), "mechanic@example.test", "Maya Mechanic", UserRole.Mechanic),
        (Guid.Parse("00000000-0000-0000-0000-000000000d01"), "bodyshop@example.test", "Bo Bodyshop", UserRole.BodyShop),
        (Guid.Parse("00000000-0000-0000-0000-000000000a01"), "admin@example.test", "Ada Admin", UserRole.Admin),
    ];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var hash = new Auth.IdentityPasswordHasher().Hash(SyntheticPassword);
        var existing = await db.Users.ToListAsync(ct);
        foreach (var (id, email, name, role) in Identities)
        {
            var user = existing.FirstOrDefault(u => u.Email == email);
            if (user is null)
                db.Users.Add(new User { Id = id, Email = email, DisplayName = name, Role = role, IsActive = true, EmailVerified = true, PasswordHash = hash });
            else if (user.PasswordHash is null)
            {
                user.PasswordHash = hash;
                user.EmailVerified = true;
            }
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>One real account for a deployed host: created if missing, otherwise made active and verified with the given password.</summary>
    public static async Task SeedAccountAsync(AppDbContext db, string email, string password, string displayName, UserRole role, CancellationToken ct = default)
    {
        var hash = new Auth.IdentityPasswordHasher().Hash(password);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null)
            db.Users.Add(new User { Id = Guid.NewGuid(), Email = email, DisplayName = displayName, Role = role, IsActive = true, EmailVerified = true, PasswordHash = hash });
        else
        {
            user.PasswordHash = hash;
            user.EmailVerified = true;
            user.IsActive = true;
        }
        await db.SaveChangesAsync(ct);
    }
}

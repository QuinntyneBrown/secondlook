using Microsoft.EntityFrameworkCore;
using SecondLook.Domain.Users;

namespace SecondLook.Infrastructure.Persistence;

/// <summary>Synthetic identities for local, e2e and demo hosts. Safe to re-run.</summary>
public static class PlatformSeeder
{
    public static readonly (Guid Id, string Email, string Name, UserRole Role)[] Identities =
    [
        (Guid.Parse("00000000-0000-0000-0000-000000000b01"), "buyer@example.test", "Sam Buyer", UserRole.Buyer),
        (Guid.Parse("00000000-0000-0000-0000-000000000c01"), "mechanic@example.test", "Maya Mechanic", UserRole.Mechanic),
        (Guid.Parse("00000000-0000-0000-0000-000000000d01"), "bodyshop@example.test", "Bo Bodyshop", UserRole.BodyShop),
        (Guid.Parse("00000000-0000-0000-0000-000000000a01"), "admin@example.test", "Ada Admin", UserRole.Admin),
    ];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var existing = await db.Users.Select(u => u.Email).ToListAsync(ct);
        foreach (var (id, email, name, role) in Identities.Where(i => !existing.Contains(i.Email)))
            db.Users.Add(new User { Id = id, Email = email, DisplayName = name, Role = role, IsActive = true });
        await db.SaveChangesAsync(ct);
    }
}

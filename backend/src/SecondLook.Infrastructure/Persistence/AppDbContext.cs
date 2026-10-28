using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Users;

namespace SecondLook.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AccountToken> AccountTokens => Set<AccountToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(200).IsRequired();
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
            e.Property(u => u.PasswordHash).HasMaxLength(512);
            e.Property(u => u.ApprovalStatus).HasConversion<string>().HasMaxLength(20);
            e.Property(u => u.LicenceNumber).HasMaxLength(60);
            e.Property(u => u.Location).HasMaxLength(200);
            e.Ignore(u => u.IsProvider).Ignore(u => u.IsApproved).Ignore(u => u.CanTakeInspections);
            e.HasIndex(u => u.Email).IsUnique();
        });
        modelBuilder.Entity<AccountToken>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Purpose).HasMaxLength(40).IsRequired();
            e.Property(t => t.TokenHash).HasMaxLength(100).IsRequired();
            e.Property(t => t.ExpiresAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(t => t.UsedAt).HasConversion(d => d == null ? (long?)null : d.Value.ToUnixTimeMilliseconds(), v => v == null ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeMilliseconds(v.Value));
            e.HasIndex(t => t.TokenHash).IsUnique();
        });
    }
}

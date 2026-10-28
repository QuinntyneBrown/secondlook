using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Users;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AccountToken> AccountTokens => Set<AccountToken>();
    public DbSet<AvailabilityWindow> AvailabilityWindows => Set<AvailabilityWindow>();
    public DbSet<SlotReservation> SlotReservations => Set<SlotReservation>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<Checkout> Checkouts => Set<Checkout>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<PricingWindow> PricingWindows => Set<PricingWindow>();
    public DbSet<Inspection> Inspections => Set<Inspection>();

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
        modelBuilder.Entity<AvailabilityWindow>(e =>
        {
            e.HasKey(w => w.Id);
            e.Property(w => w.StartUtc).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(w => w.EndUtc).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.HasIndex(w => new { w.ProviderId, w.StartUtc });
        });
        modelBuilder.Entity<SlotReservation>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(r => r.StartUtc).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(r => r.ExpiresAt).HasConversion(d => d == null ? (long?)null : d.Value.ToUnixTimeMilliseconds(), v => v == null ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeMilliseconds(v.Value));
            e.HasIndex(r => new { r.ProviderId, r.StartUtc }).IsUnique();
        });
        modelBuilder.Entity<Vehicle>(e =>
        {
            e.HasKey(v => v.Id);
            e.Property(v => v.Vin).HasMaxLength(17).IsRequired();
            e.Property(v => v.AskingPrice).HasPrecision(18, 2);
            e.Property(v => v.ListingUrl).HasMaxLength(500);
            e.Property(v => v.SellerName).HasMaxLength(100).IsRequired();
            e.Property(v => v.SellerPhone).HasMaxLength(10).IsRequired();
            e.Property(v => v.RemovedAt).HasConversion(d => d == null ? (long?)null : d.Value.ToUnixTimeMilliseconds(), v => v == null ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeMilliseconds(v.Value));
            e.Ignore(v => v.IsSaved);
            e.HasIndex(v => new { v.BuyerId, v.Vin });
        });
        modelBuilder.Entity<Checkout>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Review).HasConversion<string>().HasMaxLength(20);
            e.Property(c => c.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(c => c.IdempotencyKey).HasMaxLength(100).IsRequired();
            e.Property(c => c.CreatedAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.HasIndex(c => new { c.BuyerId, c.IdempotencyKey }).IsUnique();
        });
        modelBuilder.Entity<Payment>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Description).HasMaxLength(120);
            e.Property(p => p.CardBrand).HasMaxLength(20);
            e.Property(p => p.CardLast4).HasMaxLength(4);
            e.Property(p => p.ProcessorReference).HasMaxLength(100);
            e.Property(p => p.PaidAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(p => p.RefundedAt).HasConversion(d => d == null ? (long?)null : d.Value.ToUnixTimeMilliseconds(), v => v == null ? (DateTimeOffset?)null : DateTimeOffset.FromUnixTimeMilliseconds(v.Value));
            e.Ignore(p => p.Status);
            e.HasIndex(p => p.CheckoutId).IsUnique();
        });
        modelBuilder.Entity<PricingWindow>(e =>
        {
            e.HasKey(w => w.Id);
            e.Property(w => w.StartsAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(w => w.EndsAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.HasIndex(w => w.BuyerId);
        });
        modelBuilder.Entity<Inspection>(e =>
        {
            e.HasKey(i => i.Id);
            e.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(i => i.Review).HasConversion<string>().HasMaxLength(20);
            e.Property(i => i.StartUtc).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(i => i.EndUtc).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(i => i.CreatedAt).HasConversion(d => d.ToUnixTimeMilliseconds(), v => DateTimeOffset.FromUnixTimeMilliseconds(v));
            e.Property(i => i.Vin).HasMaxLength(17).IsRequired();
            e.Property(i => i.AskingPrice).HasPrecision(18, 2);
            e.Property(i => i.ListingUrl).HasMaxLength(500);
            e.Property(i => i.SellerName).HasMaxLength(100).IsRequired();
            e.Property(i => i.SellerPhone).HasMaxLength(10).IsRequired();
            e.HasIndex(i => i.CheckoutId).IsUnique();
            e.HasIndex(i => i.BuyerId);
            e.HasIndex(i => i.MechanicId);
        });
    }
}

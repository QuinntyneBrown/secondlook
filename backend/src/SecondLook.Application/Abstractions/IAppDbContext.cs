using Microsoft.EntityFrameworkCore;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Users;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<AccountToken> AccountTokens { get; }
    DbSet<AvailabilityWindow> AvailabilityWindows { get; }
    DbSet<SlotReservation> SlotReservations { get; }
    DbSet<Vehicle> Vehicles { get; }
    DbSet<Checkout> Checkouts { get; }
    DbSet<Payment> Payments { get; }
    DbSet<PricingWindow> PricingWindows { get; }
    Microsoft.EntityFrameworkCore.ChangeTracking.ChangeTracker ChangeTracker { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

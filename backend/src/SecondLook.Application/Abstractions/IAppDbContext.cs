using Microsoft.EntityFrameworkCore;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<AccountToken> AccountTokens { get; }
    DbSet<AvailabilityWindow> AvailabilityWindows { get; }
    DbSet<SlotReservation> SlotReservations { get; }
    Microsoft.EntityFrameworkCore.ChangeTracking.ChangeTracker ChangeTracker { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

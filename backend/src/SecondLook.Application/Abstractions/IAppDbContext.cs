using Microsoft.EntityFrameworkCore;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<AccountToken> AccountTokens { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

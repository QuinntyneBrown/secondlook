using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SecondLook.Infrastructure.Persistence;

/// <summary>Design-time only: lets `dotnet ef migrations add` build the SQL Server model.</summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer("Server=localhost;Database=SecondLookDesignTime;Trusted_Connection=True;TrustServerCertificate=True;")
            .Options);
}

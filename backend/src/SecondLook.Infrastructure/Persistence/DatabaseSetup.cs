using Microsoft.EntityFrameworkCore;

namespace SecondLook.Infrastructure.Persistence;

public static class DatabaseSetup
{
    public static DbContextOptions<AppDbContext> Options(string provider, string connection)
    {
        var b = new DbContextOptionsBuilder<AppDbContext>();
        if (provider == "Sqlite") b.UseSqlite(connection);
        else b.UseSqlServer(connection);
        return b.Options;
    }

    /// <summary>SQL Server applies EF migrations; SQLite hosts build the schema from the model.</summary>
    public static Task MigrateAsync(AppDbContext db, string provider, CancellationToken ct = default) =>
        provider == "Sqlite" ? db.Database.EnsureCreatedAsync(ct) : db.Database.MigrateAsync(ct);
}

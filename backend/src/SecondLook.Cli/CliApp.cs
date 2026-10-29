using Microsoft.Data.Sqlite;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Auth;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Cli;

public static class CliApp
{
    private const string Usage = """
        Usage: secondlook <command> [--provider Sqlite|SqlServer] [--connection <connection string>]
          migrate                  Create or update the schema (explicit; the API never migrates).
          seed                     Add the synthetic buyer/mechanic/body-shop/admin identities (idempotent).
          seed-account --email <email> --password <password> [--name <name>] [--role Admin]
                                   Create or update one verified account with that password (idempotent).
          reset                    Delete the database and migrate it again (empty).
          token --email <email>    Print a local JWT for a seeded identity (development only).
        Connection falls back to SecondLook:Database:ConnectionString / SECONDLOOK_CONNECTION.
        """;

    public static async Task<int> RunAsync(string[] args, IConfiguration config, TextWriter output, TextWriter error)
    {
        var command = args.FirstOrDefault();
        if (command is not ("migrate" or "seed" or "seed-account" or "reset" or "token"))
        {
            await error.WriteLineAsync(Usage);
            return 2;
        }

        string? Option(string name) =>
            Array.IndexOf(args, name) is var i and >= 0 && i + 1 < args.Length ? args[i + 1] : null;

        var provider = Option("--provider") ?? config["SecondLook:Database:Provider"] ?? "SqlServer";
        var connection = Option("--connection") ?? config["SecondLook:Database:ConnectionString"]
            ?? Environment.GetEnvironmentVariable("SECONDLOOK_CONNECTION");
        if (string.IsNullOrWhiteSpace(connection))
        {
            await error.WriteLineAsync("No connection string. Pass --connection or set SECONDLOOK_CONNECTION.");
            return 2;
        }

        try
        {
            await using var db = new AppDbContext(DatabaseSetup.Options(provider, connection));
            switch (command)
            {
                case "migrate":
                    await DatabaseSetup.MigrateAsync(db, provider);
                    await output.WriteLineAsync("Database is up to date.");
                    return 0;
                case "seed-account":
                    var accountEmail = Option("--email");
                    var accountPassword = Option("--password");
                    if (string.IsNullOrWhiteSpace(accountEmail) || string.IsNullOrEmpty(accountPassword))
                    {
                        await error.WriteLineAsync("seed-account needs --email and --password.");
                        return 2;
                    }
                    if (!Enum.TryParse<UserRole>(Option("--role") ?? "Admin", true, out var accountRole))
                    {
                        await error.WriteLineAsync("--role must be Buyer, Mechanic, BodyShop or Admin.");
                        return 2;
                    }
                    if (!await SchemaExists(db))
                    {
                        await error.WriteLineAsync("The database has no schema. Run `secondlook migrate` first.");
                        return 1;
                    }
                    await PlatformSeeder.SeedAccountAsync(db, accountEmail, accountPassword, Option("--name") ?? accountEmail, accountRole);
                    await output.WriteLineAsync($"Account {accountEmail} is ready.");
                    return 0;
                case "reset":
                    await db.Database.EnsureDeletedAsync();
                    await DatabaseSetup.MigrateAsync(db, provider);
                    await output.WriteLineAsync("Database reset (empty).");
                    return 0;
                case "seed":
                    if (!await SchemaExists(db))
                    {
                        await error.WriteLineAsync("The database has no schema. Run `secondlook migrate` first.");
                        return 1;
                    }
                    await PlatformSeeder.SeedAsync(db);
                    await output.WriteLineAsync("Seeded synthetic identities.");
                    return 0;
                default:
                    var email = Option("--email");
                    var user = email is null ? null : await db.Users.FirstOrDefaultAsync(u => u.Email == email);
                    if (user is null)
                    {
                        await error.WriteLineAsync($"No seeded identity '{email}'. Run `secondlook seed`.");
                        return 1;
                    }
                    await output.WriteLineAsync(new JwtTokenService(config).Issue(user));
                    return 0;
            }
        }
        catch (Exception ex) when (ex is InvalidOperationException or SqliteException or SqlException or DbUpdateException)
        {
            await error.WriteLineAsync($"Failed: {ex.Message}");
            return 1;
        }
    }

    private static async Task<bool> SchemaExists(AppDbContext db)
    {
        try { await db.Users.AnyAsync(); return true; }
        catch (Exception ex) when (ex is SqliteException or SqlException) { return false; }
    }
}

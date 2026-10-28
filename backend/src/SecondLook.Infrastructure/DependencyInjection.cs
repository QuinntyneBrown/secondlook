using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Application.Abstractions;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var provider = DatabaseSettings.Provider(configuration);
        var connection = DatabaseSettings.ConnectionString(configuration);
        services.AddDbContext<AppDbContext>(o =>
        {
            if (provider == "Sqlite") o.UseSqlite(connection);
            else o.UseSqlServer(connection, s => s.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        return services;
    }
}

public static class DatabaseSettings
{
    public static string Provider(IConfiguration c)
    {
        var provider = c["SecondLook:Database:Provider"] ?? "SqlServer";
        return provider is "Sqlite" or "SqlServer"
            ? provider
            : throw new InvalidOperationException(
                $"SecondLook:Database:Provider must be 'Sqlite' or 'SqlServer', not '{provider}'.");
    }

    public static string ConnectionString(IConfiguration c) =>
        c["SecondLook:Database:ConnectionString"]
        ?? Environment.GetEnvironmentVariable("SECONDLOOK_CONNECTION")
        ?? throw new InvalidOperationException(
            "No database connection string. Set SecondLook:Database:ConnectionString or SECONDLOOK_CONNECTION.");
}

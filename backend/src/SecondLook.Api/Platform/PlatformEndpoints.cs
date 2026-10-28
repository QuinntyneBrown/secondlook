using Microsoft.EntityFrameworkCore;
using SecondLook.Api.Auth;
using SecondLook.Application.Scoping;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Platform;

public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/platform");

        group.MapGet("/me", async (ICurrentUser caller, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Users.SingleAsync(u => u.Id == caller.Id, ct);
            return Results.Ok(new { userId = user.Id, email = user.Email, displayName = user.DisplayName, role = user.Role.ToString() });
        });

        var access = group.MapGroup("/access");
        access.MapGet("/buyer", () => Results.Ok(new { access = "buyer" })).RequireAuthorization(Policies.Buyer);
        access.MapGet("/mechanic", () => Results.Ok(new { access = "mechanic" })).RequireAuthorization(Policies.Mechanic);
        access.MapGet("/body-shop", () => Results.Ok(new { access = "body-shop" })).RequireAuthorization(Policies.BodyShop);
        access.MapGet("/admin", () => Results.Ok(new { access = "admin" })).RequireAuthorization(Policies.Admin);

        var env = app.ServiceProvider.GetRequiredService<IHostEnvironment>();
        var config = app.ServiceProvider.GetRequiredService<IConfiguration>();
        if (env.IsDevelopment() || config.GetValue<bool>("SecondLook:Diagnostics:EnableFaultEndpoint"))
        {
            group.MapGet("/diagnostics/fault", () => { throw new InvalidOperationException("deliberate platform fault"); })
                .RequireAuthorization(Policies.Admin);

            // The local mail adapter keeps mail in memory; e2e and demos read the emailed link here.
            group.MapGet("/diagnostics/mailbox", (string email, string purpose, SecondLook.Application.Accounts.LocalMailbox mailbox) =>
                    Results.Ok(new { token = mailbox.LastTokenFor(email, purpose) }))
                .AllowAnonymous();
        }
        return app;
    }
}

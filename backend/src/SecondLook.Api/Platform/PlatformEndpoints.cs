using SecondLook.Api.Auth;

namespace SecondLook.Api.Platform;

public static class PlatformEndpoints
{
    public static IEndpointRouteBuilder MapPlatformEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/platform");

        group.MapGet("/me", (HttpContext http) => Results.Ok(new
        {
            userId = Guid.Parse(http.User.FindFirst("sub")!.Value),
            role = http.User.FindFirst("role")?.Value,
        }));

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
        }
        return app;
    }
}

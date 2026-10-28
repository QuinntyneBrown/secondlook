using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Auth;

public static class Policies
{
    public const string Buyer = "Buyer";
    public const string Mechanic = "Mechanic";
    public const string BodyShop = "BodyShop";
    public const string Admin = "Admin";
}

public static class AuthServiceCollectionExtensions
{
    public static IServiceCollection AddSecondLookAuth(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("SecondLook:Jwt");
        var signingKey = jwt["SigningKey"];
        if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
            throw new InvalidOperationException(
                "SecondLook:Jwt:SigningKey must be at least 32 characters. Set it with user-secrets or SecondLook__Jwt__SigningKey; never commit it.");

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt["Issuer"],
                    ValidateAudience = true,
                    ValidAudience = jwt["Audience"],
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = "sub",
                    RoleClaimType = "role",
                };
                // A valid signature is not enough: the user must still exist and be active (L2-069 AC4).
                o.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        var sub = context.Principal?.FindFirst("sub")?.Value;
                        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                        if (!Guid.TryParse(sub, out var id) || !await db.Users.AnyAsync(u => u.Id == id && u.IsActive))
                            context.Fail("Unknown or inactive user.");
                    },
                };
            });
        services.AddScoped<ICurrentUser, HttpCurrentUser>();
        services.AddHttpContextAccessor();

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(Policies.Buyer, p => p.RequireRole(Policies.Buyer))
            .AddPolicy(Policies.Mechanic, p => p.RequireRole(Policies.Mechanic))
            .AddPolicy(Policies.BodyShop, p => p.RequireRole(Policies.BodyShop))
            .AddPolicy(Policies.Admin, p => p.RequireRole(Policies.Admin));
        return services;
    }
}

/// <summary>The caller as seen by handlers, read from the validated token only.</summary>
public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private System.Security.Claims.ClaimsPrincipal Principal =>
        accessor.HttpContext?.User ?? throw new InvalidOperationException("No authenticated caller.");

    public Guid Id => Guid.Parse(Principal.FindFirst("sub")!.Value);
    public UserRole Role => Enum.Parse<UserRole>(Principal.FindFirst("role")!.Value);
}

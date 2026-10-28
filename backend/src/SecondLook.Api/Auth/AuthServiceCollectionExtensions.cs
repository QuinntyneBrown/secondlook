using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;

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
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build())
            .AddPolicy(Policies.Buyer, p => p.RequireRole(Policies.Buyer))
            .AddPolicy(Policies.Mechanic, p => p.RequireRole(Policies.Mechanic))
            .AddPolicy(Policies.BodyShop, p => p.RequireRole(Policies.BodyShop))
            .AddPolicy(Policies.Admin, p => p.RequireRole(Policies.Admin));
        return services;
    }
}

using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SecondLook.Domain.Users;

namespace SecondLook.Infrastructure.Auth;

/// <summary>Issues local JWTs with the claims the API validates ("sub", "role").</summary>
public sealed class JwtTokenService(IConfiguration configuration) : SecondLook.Application.Accounts.IAccessTokenIssuer
{
    public string Issue(User user) => Issue(user, null);

    public string Issue(User user, TimeSpan? lifetime = null)
    {
        var jwt = configuration.GetSection("SecondLook:Jwt");
        var key = jwt["SigningKey"];
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("SecondLook:Jwt:SigningKey must be at least 32 characters.");
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(jwt["Issuer"], jwt["Audience"],
            [new("sub", user.Id.ToString()), new("role", user.Role.ToString()), new("email", user.Email)],
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromHours(8)), creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

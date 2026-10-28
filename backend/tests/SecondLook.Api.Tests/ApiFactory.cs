using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.IdentityModel.Tokens;

namespace SecondLook.Api.Tests;

/// <summary>Hosts the real API on a per-fixture in-memory SQLite database.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Issuer = "secondlook-tests";
    public const string Audience = "secondlook-api-tests";
    public const string SigningKey = "test-only-signing-key-0123456789-abcdefghijklmnop";

    private readonly string _database = $"file:sl{Guid.NewGuid():N}?mode=memory&cache=shared";
    private SqliteConnection? _keepAlive;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _keepAlive = new SqliteConnection($"Data Source={_database}");
        _keepAlive.Open();
        builder.UseEnvironment("Development");
        builder.UseSetting("SecondLook:Database:Provider", "Sqlite");
        builder.UseSetting("SecondLook:Database:ConnectionString", $"Data Source={_database}");
        builder.UseSetting("SecondLook:Jwt:Issuer", Issuer);
        builder.UseSetting("SecondLook:Jwt:Audience", Audience);
        builder.UseSetting("SecondLook:Jwt:SigningKey", SigningKey);
    }

    public HttpClient ClientFor(string? role, Guid? userId = null, DateTime? expires = null,
        string signingKey = SigningKey, string issuer = Issuer)
    {
        var client = CreateClient();
        if (role is null) return client;
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, (userId ?? Guid.NewGuid()).ToString()),
            new(ClaimTypes.Role, role),
        };
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(issuer, Audience, claims,
            notBefore: DateTime.UtcNow.AddMinutes(-10), expires: expires ?? DateTime.UtcNow.AddMinutes(30), signingCredentials: creds);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        return client;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _keepAlive?.Dispose();
    }
}

using System.Net;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Platform;

/// <summary>Tests that change shared state each get their own host and database.</summary>
public class InactiveUserTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public InactiveUserTests(ApiFactory factory) => _factory = factory;

    // L2-069 AC4: a valid token for a deactivated user is rejected.
    [Fact]
    public async Task Token_for_an_inactive_user_is_401()
    {
        _factory.EnsureSeeded();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(u => u.Email == "bodyshop@example.test");
            user.IsActive = false;
            await db.SaveChangesAsync();
        }
        var client = _factory.ClientFor("BodyShop");
        (await client.GetAsync("/api/platform/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

public class ReadinessTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public ReadinessTests(ApiFactory factory) => _factory = factory;

    // L2-068 AC3: an unreachable database is 503 problem+json with no internals.
    [Fact]
    public async Task Readiness_is_503_problem_json_when_the_database_is_unusable()
    {
        var client = _factory.ClientFor(null);
        using (var scope = _factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync("DROP TABLE Users");
        var response = await client.GetAsync("/health/ready");
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().NotContain("Data Source").And.NotContain("SqliteException");
    }
}

public class ConfigurationTests
{
    // L2-066 AC4: an unknown provider fails at startup naming the setting.
    [Fact]
    public void Unknown_database_provider_fails_startup_naming_the_setting()
    {
        using var factory = new ApiFactory("Oracle");
        var act = () => factory.CreateClient();
        act.Should().Throw<Exception>().Which.ToString().Should().Contain("SecondLook:Database:Provider");
    }
}

public class SwaggerTests
{
    // L2-069 AC5: Swagger is anonymous in Development only.
    [Fact]
    public async Task Swagger_is_anonymous_in_development()
    {
        using var factory = new ApiFactory("Sqlite", "Development");
        var response = await factory.ClientFor(null).GetAsync("/swagger/v1/swagger.json");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Swagger_is_not_served_in_production()
    {
        using var factory = new ApiFactory("Sqlite", "Production");
        var response = await factory.ClientFor(null).GetAsync("/swagger/v1/swagger.json");
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Unauthorized, HttpStatusCode.NotFound);
    }
}

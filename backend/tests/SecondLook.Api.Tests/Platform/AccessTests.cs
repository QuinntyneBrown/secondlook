using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Platform;

public class AccessTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public AccessTests(ApiFactory factory) => _factory = factory;

    // L2-069 AC1: endpoints require authentication by default.
    [Fact]
    public async Task Anonymous_request_to_protected_endpoint_is_401()
    {
        var response = await _factory.ClientFor(null).GetAsync("/api/platform/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // L2-069 AC2: a valid token is accepted and identifies the caller.
    [Fact]
    public async Task Valid_token_identifies_the_caller()
    {
        var id = ApiFactory.SeededId("Buyer");
        var response = await _factory.ClientFor("Buyer", id).GetAsync("/api/platform/me");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("userId").GetGuid().Should().Be(id);
        body.GetProperty("role").GetString().Should().Be("Buyer");
        body.GetProperty("email").GetString().Should().Be("buyer@example.test");
        body.GetProperty("displayName").GetString().Should().Be("Sam Buyer");
    }

    // L2-069 AC4: a valid token for an unknown user is rejected.
    [Fact]
    public async Task Token_for_an_unknown_user_is_401()
    {
        var client = _factory.ClientFor("Buyer", Guid.NewGuid());
        (await client.GetAsync("/api/platform/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // L2-069 AC3: expired and wrongly signed tokens are rejected.
    [Fact]
    public async Task Expired_token_is_401()
    {
        var client = _factory.ClientFor("Buyer", expires: DateTime.UtcNow.AddMinutes(-5));
        (await client.GetAsync("/api/platform/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_signed_with_another_key_is_401()
    {
        var client = _factory.ClientFor("Buyer", signingKey: "another-signing-key-0123456789-abcdefghijklmnopqrs");
        (await client.GetAsync("/api/platform/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_from_another_issuer_is_401()
    {
        var client = _factory.ClientFor("Buyer", issuer: "someone-else");
        (await client.GetAsync("/api/platform/me")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // L2-070 AC1/AC2: role policies allow the matching role and forbid others with problem+json.
    [Theory]
    [InlineData("buyer", "Buyer")]
    [InlineData("mechanic", "Mechanic")]
    [InlineData("body-shop", "BodyShop")]
    [InlineData("admin", "Admin")]
    public async Task Role_endpoint_allows_its_role(string route, string role)
    {
        var response = await _factory.ClientFor(role).GetAsync($"/api/platform/access/{route}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData("admin", "Buyer")]
    [InlineData("buyer", "Mechanic")]
    [InlineData("mechanic", "BodyShop")]
    [InlineData("body-shop", "Admin")]
    public async Task Role_endpoint_forbids_other_roles_with_problem_details(string route, string role)
    {
        var response = await _factory.ClientFor(role).GetAsync($"/api/platform/access/{route}");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task Role_endpoint_without_token_is_401()
    {
        (await _factory.ClientFor(null).GetAsync("/api/platform/access/buyer")).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }
}

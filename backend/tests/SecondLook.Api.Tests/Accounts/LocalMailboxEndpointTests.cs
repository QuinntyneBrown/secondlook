using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Accounts;

public class LocalMailboxEndpointTests
{
    // J01 demo and e2e: the local mail adapter exposes the last emailed link, in Development only.
    [Fact]
    public async Task Development_host_exposes_the_last_emailed_token()
    {
        using var factory = new ApiFactory();
        var client = factory.ClientFor(null);
        await client.PostAsJsonAsync("/api/auth/register", new { fullName = "A B", email = "mailbox@example.test", password = "a-long-password", acceptedTerms = true });
        var response = await client.GetAsync("/api/platform/diagnostics/mailbox?email=mailbox@example.test&purpose=verify-email");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Production_host_does_not_expose_the_mailbox()
    {
        using var factory = new ApiFactory("Sqlite", "Production");
        var response = await factory.ClientFor(null).GetAsync("/api/platform/diagnostics/mailbox?email=a@example.test&purpose=verify-email");
        response.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Unauthorized);
    }

    // J01: seeded synthetic identities can sign in with the documented synthetic password.
    [Theory]
    [InlineData("buyer@example.test")]
    [InlineData("mechanic@example.test")]
    [InlineData("bodyshop@example.test")]
    [InlineData("admin@example.test")]
    public async Task Seeded_identities_can_sign_in(string email)
    {
        using var factory = new ApiFactory();
        var client = factory.ClientFor(null);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = "Password-123!" });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

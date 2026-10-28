using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Accounts;

public class VerificationAndSignInTests : IClassFixture<ApiFactory>
{
    private const string Password = "a-long-password";
    private readonly ApiFactory _factory;
    public VerificationAndSignInTests(ApiFactory factory) => _factory = factory;

    private HttpClient Anon => _factory.ClientFor(null);

    private async Task<string> RegisterAsync(string email, string role = "Buyer")
    {
        (await Anon.PostAsJsonAsync("/api/auth/register", new { fullName = "Jordan Lee", email, password = Password, acceptedTerms = true, role }))
            .StatusCode.Should().Be(HttpStatusCode.Created);
        return email;
    }

    private string LastToken(string email) => _factory.Mailbox.LastTokenFor(email, "verify-email");

    private Task<HttpResponseMessage> Login(string email, string password = Password) =>
        Anon.PostAsJsonAsync("/api/auth/login", new { email, password });

    // L2-012 AC1: registering sends a verification email through the local mailbox adapter.
    [Fact]
    public async Task Registration_sends_a_verification_email()
    {
        var email = await RegisterAsync("verify1@example.test");
        LastToken(email).Should().NotBeNullOrEmpty();
    }

    // L2-012 AC3: a valid link verifies the email; the link works once.
    [Fact]
    public async Task Valid_link_verifies_the_email_once()
    {
        var email = await RegisterAsync("verify2@example.test");
        var token = LastToken(email);
        (await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Login(email)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // L2-012 AC4: verification links expire after 24 hours.
    [Fact]
    public async Task Expired_link_is_gone_and_a_new_one_can_be_sent()
    {
        var email = await RegisterAsync("verify3@example.test");
        var old = LastToken(email);
        _factory.Clock.Advance(TimeSpan.FromHours(25));
        var response = await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token = old });
        response.StatusCode.Should().Be(HttpStatusCode.Gone);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString().Should().Be("That link has expired");
        (await Anon.PostAsJsonAsync("/api/auth/resend-verification", new { email })).StatusCode.Should().Be(HttpStatusCode.Accepted);
        var fresh = LastToken(email);
        fresh.Should().NotBe(old);
        (await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token = fresh })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Resending never reveals whether an account exists.
    [Fact]
    public async Task Resend_for_an_unknown_email_is_still_accepted()
    {
        (await Anon.PostAsJsonAsync("/api/auth/resend-verification", new { email = "nobody@example.test" })).StatusCode
            .Should().Be(HttpStatusCode.Accepted);
    }

    // L2-008 AC2: valid credentials sign a verified user in with a JWT the API accepts.
    [Fact]
    public async Task Valid_credentials_return_a_working_token()
    {
        var email = await RegisterAsync("login1@example.test");
        await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token = LastToken(email) });
        var response = await Login(email.ToUpperInvariant());
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var jwt = body.GetProperty("token").GetString()!;
        new JwtSecurityTokenHandler().ReadJwtToken(jwt).Claims.Should().Contain(c => c.Type == "role" && c.Value == "Buyer");
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", jwt);
        var me = await client.GetAsync("/api/platform/me");
        me.StatusCode.Should().Be(HttpStatusCode.OK);
        (await me.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("email").GetString().Should().Be(email);
    }

    // L2-008 AC4: wrong password and unknown email look identical.
    [Theory]
    [InlineData("registered", "wrong-password-here")]
    [InlineData("nobody@example.test", "a-long-password")]
    public async Task Bad_credentials_are_401_with_the_same_message(string email, string password)
    {
        var registered = await RegisterAsync($"bad{Guid.NewGuid():N}@example.test");
        var response = await Login(email == "registered" ? registered : email, password);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString().Should().Be("That email and password don’t match");
    }

    // An unverified account cannot sign in yet.
    [Fact]
    public async Task Unverified_account_cannot_sign_in()
    {
        var email = await RegisterAsync("login3@example.test");
        (await Login(email)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // J01: a provider can sign in as its own kind of user but is not approved.
    [Fact]
    public async Task Provider_signs_in_as_provider_without_approval()
    {
        var email = await RegisterAsync("shop1@example.test", "BodyShop");
        await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token = LastToken(email) });
        var body = await (await Login(email)).Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("role").GetString().Should().Be("BodyShop");
        body.GetProperty("isApproved").GetBoolean().Should().BeFalse();
    }

    // L2-009 AC1: missing fields are a validation problem.
    [Fact]
    public async Task Login_validation_lists_field_errors()
    {
        var response = await Anon.PostAsJsonAsync("/api/auth/login", new { email = "jordan.lee@", password = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        errors.GetProperty("email")[0].GetString().Should().Be("Enter a valid email address.");
        errors.GetProperty("password")[0].GetString().Should().Be("Enter your password.");
    }
}

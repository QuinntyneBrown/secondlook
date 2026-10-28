using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Accounts;

public class PasswordResetTests : IClassFixture<ApiFactory>
{
    private const string OldPassword = "a-long-password";
    private readonly ApiFactory _factory;
    public PasswordResetTests(ApiFactory factory) => _factory = factory;

    private HttpClient Anon => _factory.ClientFor(null);

    private async Task<string> VerifiedAccount()
    {
        var email = $"reset{Guid.NewGuid():N}@example.test";
        await Anon.PostAsJsonAsync("/api/auth/register", new { fullName = "Jordan Lee", email, password = OldPassword, acceptedTerms = true });
        await Anon.PostAsJsonAsync("/api/auth/verify-email", new { token = _factory.Mailbox.LastTokenFor(email, "verify-email") });
        return email;
    }

    private Task<HttpResponseMessage> Reset(string token, string password, string? confirm = null) =>
        Anon.PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = password, confirmPassword = confirm ?? password });

    // L2-010 AC4: a reset request is accepted and mails a link for an existing account.
    [Fact]
    public async Task Forgot_password_mails_a_link()
    {
        var email = await VerifiedAccount();
        (await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email })).StatusCode.Should().Be(HttpStatusCode.Accepted);
        _factory.Mailbox.LastTokenFor(email, "reset-password").Should().NotBeNullOrEmpty();
    }

    // L2-010: the response never reveals whether an account exists.
    [Fact]
    public async Task Forgot_password_for_an_unknown_email_is_still_accepted()
    {
        (await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email = "nobody@example.test" })).StatusCode
            .Should().Be(HttpStatusCode.Accepted);
    }

    // L2-010 AC2: an invalid email is a validation problem.
    [Fact]
    public async Task Forgot_password_validates_the_email()
    {
        var response = await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email = "jordan.lee" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors").GetProperty("email")[0].GetString()
            .Should().Be("Enter a valid email address.");
    }

    // L2-011 AC4: a valid reset signs the user in with the new password; the old one stops working; the link is single-use.
    [Fact]
    public async Task Reset_changes_the_password_and_signs_in()
    {
        var email = await VerifiedAccount();
        await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = _factory.Mailbox.LastTokenFor(email, "reset-password");
        var response = await Reset(token, "brand-new-password");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString().Should().NotBeNullOrEmpty();
        (await Anon.PostAsJsonAsync("/api/auth/login", new { email, password = OldPassword })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await Anon.PostAsJsonAsync("/api/auth/login", new { email, password = "brand-new-password" })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Reset(token, "another-new-password")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // L2-011 AC2: short and mismatched passwords are field errors and nothing is changed.
    [Fact]
    public async Task Reset_validates_the_new_password()
    {
        var email = await VerifiedAccount();
        await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = _factory.Mailbox.LastTokenFor(email, "reset-password");
        var response = await Reset(token, "short", "shorter");
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        errors.GetProperty("newPassword")[0].GetString().Should().Be("Use at least 10 characters.");
        errors.GetProperty("confirmPassword")[0].GetString().Should().Be("The passwords don’t match.");
        (await Anon.PostAsJsonAsync("/api/auth/login", new { email, password = OldPassword })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Reset(token, "brand-new-password")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // L2-011 AC5: reset links work for 30 minutes.
    [Fact]
    public async Task Expired_reset_link_is_gone()
    {
        var email = await VerifiedAccount();
        await Anon.PostAsJsonAsync("/api/auth/forgot-password", new { email });
        var token = _factory.Mailbox.LastTokenFor(email, "reset-password");
        _factory.Clock.Advance(TimeSpan.FromMinutes(31));
        var response = await Reset(token, "brand-new-password");
        response.StatusCode.Should().Be(HttpStatusCode.Gone);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString().Should().Be("That link has expired");
    }

    // L2-013: signing out needs a session; the token is discarded by the client and the call succeeds.
    [Fact]
    public async Task Sign_out_requires_a_session()
    {
        (await Anon.PostAsync("/api/auth/logout", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await _factory.ClientFor("Buyer").PostAsync("/api/auth/logout", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}

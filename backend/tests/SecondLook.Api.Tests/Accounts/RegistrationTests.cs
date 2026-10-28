using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Accounts;

public class RegistrationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public RegistrationTests(ApiFactory factory) => _factory = factory;

    private Task<HttpResponseMessage> Register(object body) =>
        _factory.ClientFor(null).PostAsJsonAsync("/api/auth/register", body);

    private static object Valid(string email, string role = "Buyer") =>
        new { fullName = "Jordan Lee", email, password = "a-long-password", acceptedTerms = true, role };

    // L2-006 AC2: a valid sign-up creates an unverified buyer and asks for verification.
    [Fact]
    public async Task Valid_registration_creates_an_unverified_buyer()
    {
        var response = await Register(Valid("jordan.lee@example.test"));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("verificationRequired").GetBoolean().Should().BeTrue();
        using var scope = _factory.Services.CreateScope();
        var user = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.SingleAsync(u => u.Email == "jordan.lee@example.test");
        user.Role.Should().Be(UserRole.Buyer);
        user.EmailVerified.Should().BeFalse();
        user.PasswordHash.Should().NotBeNullOrEmpty().And.NotContain("a-long-password");
    }

    // L2-006 AC4: a second sign-up for the same email is a conflict, whatever the case.
    [Fact]
    public async Task Duplicate_email_is_a_409()
    {
        (await Register(Valid("dup@example.test"))).StatusCode.Should().Be(HttpStatusCode.Created);
        var response = await Register(Valid("DUP@example.test"));
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    // L2-007 AC1/AC2: three invalid fields give three field errors with the specified messages.
    [Fact]
    public async Task Invalid_input_lists_each_field_error()
    {
        var response = await Register(new { fullName = "", email = "jordan.lee@", password = "short", acceptedTerms = true });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        errors.GetProperty("fullName")[0].GetString().Should().Be("Enter your name.");
        errors.GetProperty("email")[0].GetString().Should().Be("Enter a valid email address.");
        errors.GetProperty("password")[0].GetString().Should().Be("Use at least 10 characters.");
    }

    [Fact]
    public async Task Terms_must_be_accepted()
    {
        var response = await Register(new { fullName = "A B", email = "terms@example.test", password = "a-long-password", acceptedTerms = false });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // L2-014 / J01: providers register as pending and are not approved; nobody can self-register as admin.
    [Theory]
    [InlineData("Mechanic")]
    [InlineData("BodyShop")]
    public async Task Provider_registration_is_pending_approval(string role)
    {
        (await Register(Valid($"pending-{role.ToLowerInvariant()}@example.test", role))).StatusCode.Should().Be(HttpStatusCode.Created);
        using var scope = _factory.Services.CreateScope();
        var user = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.SingleAsync(u => u.Email == $"pending-{role.ToLowerInvariant()}@example.test");
        user.Role.ToString().Should().Be(role);
        user.IsApproved.Should().BeFalse();
    }

    [Fact]
    public async Task Admin_cannot_be_self_registered()
    {
        (await Register(Valid("root@example.test", "Admin"))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Admin;

public class ProviderAdministrationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public ProviderAdministrationTests(ApiFactory factory) => _factory = factory;

    private HttpClient Admin => _factory.ClientFor("Admin");

    private static string UniqueEmail() => $"prov{Guid.NewGuid():N}@example.test";

    private async Task<JsonElement> Onboard(string email, string kind = "Mechanic")
    {
        var response = await Admin.PostAsJsonAsync("/api/admin/providers", new
        {
            kind, displayName = "Dev Patel", email, licenceNumber = "310T-12345", location = "Hamilton, ON",
        });
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Created, HttpStatusCode.OK);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<JsonElement> Get(Guid id) =>
        await (await Admin.GetAsync($"/api/admin/providers/{id}")).Content.ReadFromJsonAsync<JsonElement>();

    // L2-064 AC1: onboarding adds a pending provider that cannot take inspections.
    [Fact]
    public async Task Onboarding_adds_a_pending_provider()
    {
        var created = await Onboard(UniqueEmail());
        created.GetProperty("approvalStatus").GetString().Should().Be("Pending");
        created.GetProperty("canTakeInspections").GetBoolean().Should().BeFalse();
        created.GetProperty("licenceNumber").GetString().Should().Be("310T-12345");
    }

    // The provider is emailed a link to set a password (reset-password flow).
    [Fact]
    public async Task Onboarding_emails_a_set_password_link()
    {
        var email = UniqueEmail();
        await Onboard(email);
        _factory.Mailbox.LastTokenFor(email, "reset-password").Should().NotBeNullOrEmpty();
    }

    // Onboarding the same provider twice returns the existing one.
    [Fact]
    public async Task Onboarding_is_idempotent_for_the_same_email_and_kind()
    {
        var email = UniqueEmail();
        var first = await Onboard(email);
        var second = await Onboard(email);
        second.GetProperty("id").GetGuid().Should().Be(first.GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Onboarding_the_same_email_as_another_kind_is_a_conflict()
    {
        var email = UniqueEmail();
        await Onboard(email, "Mechanic");
        var response = await Admin.PostAsJsonAsync("/api/admin/providers", new { kind = "BodyShop", displayName = "X", email, licenceNumber = "L", location = "Y" });
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Onboarding_validates_its_fields()
    {
        var response = await Admin.PostAsJsonAsync("/api/admin/providers", new { kind = "Buyer", displayName = "", email = "nope", licenceNumber = "", location = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        foreach (var field in new[] { "kind", "displayName", "email", "licenceNumber", "location" })
            errors.TryGetProperty(field, out _).Should().BeTrue(field);
    }

    // L2-064 AC2: approval lets the provider take inspections; approving again is a conflict.
    [Fact]
    public async Task Approving_lets_the_provider_take_inspections()
    {
        var id = (await Onboard(UniqueEmail())).GetProperty("id").GetGuid();
        var response = await Admin.PostAsync($"/api/admin/providers/{id}/approve", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Get(id);
        body.GetProperty("approvalStatus").GetString().Should().Be("Approved");
        body.GetProperty("canTakeInspections").GetBoolean().Should().BeTrue();
        (await Admin.PostAsync($"/api/admin/providers/{id}/approve", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-064 AC3: deactivation stops new work; it needs an approved provider; approving again reactivates.
    [Fact]
    public async Task Deactivating_stops_new_work_and_can_be_undone_by_approving()
    {
        var id = (await Onboard(UniqueEmail())).GetProperty("id").GetGuid();
        (await Admin.PostAsync($"/api/admin/providers/{id}/deactivate", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);
        await Admin.PostAsync($"/api/admin/providers/{id}/approve", null);
        (await Admin.PostAsync($"/api/admin/providers/{id}/deactivate", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Get(id);
        body.GetProperty("approvalStatus").GetString().Should().Be("Deactivated");
        body.GetProperty("canTakeInspections").GetBoolean().Should().BeFalse();
        (await Admin.PostAsync($"/api/admin/providers/{id}/approve", null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Get(id)).GetProperty("canTakeInspections").GetBoolean().Should().BeTrue();
    }

    // J01 providers who registered themselves appear for approval; filters narrow the list.
    [Fact]
    public async Task List_includes_self_registered_providers_and_filters_by_status_and_kind()
    {
        var email = $"self{Guid.NewGuid():N}@example.test";
        await _factory.ClientFor(null).PostAsJsonAsync("/api/auth/register", new { fullName = "Self Shop", email, password = "a-long-password", acceptedTerms = true, role = "BodyShop" });
        var pending = await (await Admin.GetAsync("/api/admin/providers?status=Pending&kind=BodyShop")).Content.ReadFromJsonAsync<JsonElement>();
        pending.EnumerateArray().Select(p => p.GetProperty("email").GetString()).Should().Contain(email);
        pending.EnumerateArray().Should().OnlyContain(p => p.GetProperty("kind").GetString() == "BodyShop" && p.GetProperty("approvalStatus").GetString() == "Pending");
    }

    [Fact]
    public async Task Unknown_provider_is_404()
    {
        (await Admin.GetAsync($"/api/admin/providers/{Guid.NewGuid()}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Admin.PostAsync($"/api/admin/providers/{Guid.NewGuid()}/approve", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Only administrators may administer providers; buyers and providers are forbidden, anonymous callers are 401.
    [Theory]
    [InlineData("Buyer")]
    [InlineData("Mechanic")]
    [InlineData("BodyShop")]
    public async Task Non_administrators_are_forbidden(string role)
    {
        (await _factory.ClientFor(role).GetAsync("/api/admin/providers")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(role).PostAsync($"/api/admin/providers/{Guid.NewGuid()}/approve", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Anonymous_callers_are_unauthorized()
    {
        (await _factory.ClientFor(null).GetAsync("/api/admin/providers")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // J01/J02: a provider's own approval state shows at sign-in.
    [Fact]
    public async Task Sign_in_reports_the_current_approval_status()
    {
        var email = $"login{Guid.NewGuid():N}@example.test";
        var id = (await Onboard(email)).GetProperty("id").GetGuid();
        await Admin.PostAsync($"/api/admin/providers/{id}/approve", null);
        var token = _factory.Mailbox.LastTokenFor(email, "reset-password");
        var reset = await _factory.ClientFor(null).PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword = "a-long-password", confirmPassword = "a-long-password" });
        reset.StatusCode.Should().Be(HttpStatusCode.OK);
        var login = await (await _factory.ClientFor(null).PostAsJsonAsync("/api/auth/login", new { email, password = "a-long-password" })).Content.ReadFromJsonAsync<JsonElement>();
        login.GetProperty("isApproved").GetBoolean().Should().BeTrue();
    }
}

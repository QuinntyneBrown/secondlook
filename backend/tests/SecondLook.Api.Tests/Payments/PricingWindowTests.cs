using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Payments;

/// <summary>Moves the clock, so it runs on its own host (ADR 0010).</summary>
public class PricingWindowTests : IClassFixture<ApiFactory>
{
    private const string Visa = "4242 4242 4242 4242";
    private readonly ApiFactory _factory;
    public PricingWindowTests(ApiFactory factory) => _factory = factory;

    private HttpClient NewBuyer()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.NewGuid();
        db.Users.Add(new User { Id = id, Email = $"win{id:N}@example.test", DisplayName = "Wendy Window", Role = UserRole.Buyer, EmailVerified = true });
        db.SaveChanges();
        return _factory.ClientFor("Buyer", id);
    }

    private static Task<JsonElement> Json(HttpResponseMessage r) => r.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> Window(HttpClient buyer)
    {
        var response = await buyer.GetAsync("/api/pricing-window");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return await Json(response);
    }

    private async Task<Guid> PayCheckout(HttpClient buyer, string review = "Mechanic")
    {
        var id = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString() }))).GetProperty("id").GetGuid();
        var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Wendy", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
        (await buyer.PostAsJsonAsync($"/api/checkouts/{id}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
        return id;
    }

    private async Task<int> QuoteCents(HttpClient buyer, string review = "Mechanic") =>
        (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString() }))).GetProperty("quote").GetProperty("totalCents").GetInt32();

    // L2-034: a buyer who has never paid has no window and the next inspection is $50.
    [Fact]
    public async Task A_new_buyer_has_no_window()
    {
        var w = await Window(NewBuyer());
        w.GetProperty("state").GetString().Should().Be("None");
        w.GetProperty("carsInWindow").GetInt32().Should().Be(0);
        w.GetProperty("newInspectionCents").GetInt32().Should().Be(5000);
        w.GetProperty("additionalVehicleCents").GetInt32().Should().Be(2500);
        w.TryGetProperty("endsAt", out var ends).Should().BeTrue();
        ends.ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ADR 0010: the first payment opens a 14-day window.
    [Fact]
    public async Task The_first_payment_opens_a_fourteen_day_window()
    {
        var buyer = NewBuyer();
        var paidAt = _factory.Clock.GetUtcNow();
        await PayCheckout(buyer);
        var w = await Window(buyer);
        w.GetProperty("state").GetString().Should().Be("Open");
        w.GetProperty("endsAt").GetDateTimeOffset().Should().BeCloseTo(paidAt.AddDays(14), TimeSpan.FromMinutes(1));
        w.GetProperty("daysRemaining").GetInt32().Should().Be(14);
        w.GetProperty("carsInWindow").GetInt32().Should().Be(1);
    }

    // L2-027 AC2, AC3: another car in the window is $25, and $45 with both reviews; each adds to the count.
    [Fact]
    public async Task Additional_cars_in_the_window_cost_twenty_five_and_are_counted()
    {
        var buyer = NewBuyer();
        await PayCheckout(buyer);
        (await QuoteCents(buyer)).Should().Be(2500);
        (await QuoteCents(buyer, "Both")).Should().Be(4500);
        await PayCheckout(buyer, "Both");
        await PayCheckout(buyer);
        (await Window(buyer)).GetProperty("carsInWindow").GetInt32().Should().Be(3);
    }

    // ADR 0010: closing soon at two days or less remaining.
    [Fact]
    public async Task The_window_is_closing_soon_when_two_days_remain()
    {
        var buyer = NewBuyer();
        await PayCheckout(buyer);
        _factory.Clock.Advance(TimeSpan.FromDays(11));
        (await Window(buyer)).GetProperty("state").GetString().Should().Be("Open");
        _factory.Clock.Advance(TimeSpan.FromDays(1) + TimeSpan.FromHours(1));
        var w = await Window(buyer);
        w.GetProperty("state").GetString().Should().Be("ClosingSoon");
        w.GetProperty("daysRemaining").GetInt32().Should().Be(2);
    }

    // ADR 0010: the window is open until, but not including, its end instant.
    [Fact]
    public async Task The_window_closes_exactly_at_its_end()
    {
        var buyer = NewBuyer();
        await PayCheckout(buyer);
        var ends = (await Window(buyer)).GetProperty("endsAt").GetDateTimeOffset();
        _factory.Clock.Advance(ends - _factory.Clock.GetUtcNow() - TimeSpan.FromSeconds(1));
        (await QuoteCents(buyer)).Should().Be(2500);
        (await Window(buyer)).GetProperty("state").GetString().Should().NotBe("Closed");

        _factory.Clock.Advance(TimeSpan.FromSeconds(1));
        (await Window(buyer)).GetProperty("state").GetString().Should().Be("Closed");
        (await QuoteCents(buyer)).Should().Be(5000);
    }

    // L2-027 AC5: after a window closes, the next payment is $50 and starts a new window.
    [Fact]
    public async Task A_payment_after_the_window_closes_starts_a_new_one()
    {
        var buyer = NewBuyer();
        await PayCheckout(buyer);
        _factory.Clock.Advance(TimeSpan.FromDays(15));
        (await Window(buyer)).GetProperty("state").GetString().Should().Be("Closed");
        var checkout = await PayCheckout(buyer);
        var w = await Window(buyer);
        w.GetProperty("state").GetString().Should().Be("Open");
        w.GetProperty("carsInWindow").GetInt32().Should().Be(1);
        (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0].GetProperty("amountCents").GetInt32().Should().Be(5000);
        checkout.Should().NotBeEmpty();
    }

    // ADR 0010: windows belong to one buyer; only buyers read them.
    [Fact]
    public async Task Windows_are_per_buyer_and_buyer_only()
    {
        var first = NewBuyer();
        await PayCheckout(first);
        (await Window(NewBuyer())).GetProperty("state").GetString().Should().Be("None");
        (await _factory.ClientFor("Mechanic").GetAsync("/api/pricing-window")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor("Admin").GetAsync("/api/pricing-window")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(null).GetAsync("/api/pricing-window")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

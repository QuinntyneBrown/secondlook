using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Bookings;

public class BookingTests : IClassFixture<ApiFactory>
{
    private const string Visa = "4242 4242 4242 4242";
    private readonly ApiFactory _factory;
    public BookingTests(ApiFactory factory) => _factory = factory;

    private static int _day = 200;
    private static DateTimeOffset NextDay() => new(DateTimeOffset.UtcNow.Date.AddDays(Interlocked.Increment(ref _day)).AddHours(14), TimeSpan.Zero);
    private static int _vin = 500000;
    private static string NewVin() => $"2HGFC2F59GH{Interlocked.Increment(ref _vin)}";

    private HttpClient Mechanic => _factory.ClientFor("Mechanic");
    private static Task<JsonElement> Json(HttpResponseMessage r) => r.Content.ReadFromJsonAsync<JsonElement>();

    private HttpClient NewBuyer()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.NewGuid();
        db.Users.Add(new User { Id = id, Email = $"book{id:N}@example.test", DisplayName = "Bea Booker", Role = UserRole.Buyer, EmailVerified = true });
        db.SaveChanges();
        return _factory.ClientFor("Buyer", id);
    }

    private async Task<DateTimeOffset> OpenWindow(int hours = 2)
    {
        var start = NextDay();
        (await Mechanic.PostAsJsonAsync("/api/availability", new { start, end = start.AddHours(hours) })).StatusCode.Should().Be(HttpStatusCode.Created);
        return start;
    }

    private async Task<Guid> SaveVehicle(HttpClient buyer, int km = 142300)
    {
        var response = await buyer.PostAsJsonAsync("/api/vehicles", new { year = 2016, make = "Honda", model = "Civic", vin = NewVin(), odometerKm = km, askingPrice = 8900, listingUrl = "https://example.test/civic", sellerName = "Sam Whitaker", sellerPhone = "905-555-0142" });
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await Json(response)).GetProperty("id").GetGuid();
    }

    private Task<HttpResponseMessage> Hold(HttpClient buyer, DateTimeOffset start) =>
        buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = ApiFactory.SeededId("Mechanic"), start });

    private async Task<Guid> PaidCheckout(HttpClient buyer, Guid vehicleId, string review = "Mechanic")
    {
        var created = await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString(), vehicleId }));
        var id = created.GetProperty("id").GetGuid();
        var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Bea", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
        (await buyer.PostAsJsonAsync($"/api/checkouts/{id}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
        return id;
    }

    private Task<HttpResponseMessage> Confirm(HttpClient buyer, Guid checkoutId, Guid holdId, Guid vehicleId) =>
        buyer.PostAsJsonAsync("/api/bookings", new { checkoutId, holdId, vehicleId });

    private async Task<JsonElement[]> Slots(HttpClient buyer, DateTimeOffset start) =>
        (await Json(await buyer.GetAsync($"/api/slots?from={Uri.EscapeDataString(start.ToString("O"))}&to={Uri.EscapeDataString(start.AddHours(2).ToString("O"))}"))).GetProperty("slots")
            .EnumerateArray().Where(s => s.GetProperty("providerId").GetGuid() == ApiFactory.SeededId("Mechanic")).ToArray();

    // L2-025 AC3: holding takes the slot off the list for 10 minutes.
    [Fact]
    public async Task Holding_a_slot_removes_it_from_the_list_until_it_expires()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var response = await Hold(buyer, start);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var hold = await Json(response);
        hold.GetProperty("expiresAt").GetDateTimeOffset().Should().BeCloseTo(_factory.Clock.GetUtcNow().AddMinutes(10), TimeSpan.FromMinutes(1));
        (await Slots(buyer, start)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().NotContain(start);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        (await Slots(buyer, start)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().Contain(start);
    }

    // L2-025 AC8: a slot someone else holds cannot be held.
    [Fact]
    public async Task A_slot_held_by_someone_else_is_a_conflict()
    {
        var start = await OpenWindow();
        (await Hold(NewBuyer(), start)).StatusCode.Should().Be(HttpStatusCode.Created);
        var second = await Hold(NewBuyer(), start);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Json(second)).GetProperty("title").GetString().Should().Be("We couldn’t hold that slot");
    }

    [Fact]
    public async Task A_slot_that_is_not_offered_cannot_be_held()
    {
        (await Hold(NewBuyer(), NextDay().AddDays(60))).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // A buyer has one active hold: a new one releases the old.
    [Fact]
    public async Task A_new_hold_releases_the_buyers_previous_hold()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        await Hold(buyer, start);
        (await Hold(buyer, start.AddMinutes(30))).StatusCode.Should().Be(HttpStatusCode.Created);
        (await Slots(buyer, start)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().Contain(start).And.NotContain(start.AddMinutes(30));
    }

    // L2-035: hold, pay, confirm gives one scheduled inspection with a copy of the vehicle details.
    [Fact]
    public async Task A_paid_checkout_and_a_hold_confirm_one_inspection()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle, "Mechanic");
        var response = await Confirm(buyer, checkout, hold, vehicle);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var inspection = await Json(response);
        inspection.GetProperty("status").GetString().Should().Be("Scheduled");
        inspection.GetProperty("start").GetDateTimeOffset().Should().Be(start);
        inspection.GetProperty("mechanicName").GetString().Should().Be("Maya Mechanic");
        inspection.GetProperty("review").GetString().Should().Be("Mechanic");
        inspection.GetProperty("amountCents").GetInt32().Should().Be(5000);
        inspection.GetProperty("vehicle").GetProperty("sellerPhone").GetString().Should().Be("9055550142");

        // The booked slot stays taken after the hold window would have ended.
        _factory.Clock.Advance(TimeSpan.FromMinutes(15));
        (await Slots(buyer, start)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().NotContain(start);
    }

    // L2-029 AC1: the same booking posted again, or concurrently, returns the one inspection.
    [Fact]
    public async Task Confirming_twice_or_concurrently_creates_one_inspection()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle);
        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Confirm(buyer, checkout, hold, vehicle)));
        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.Created || r.StatusCode == HttpStatusCode.OK);
        (await Task.WhenAll(responses.Select(Json))).Select(j => j.GetProperty("id").GetGuid()).Distinct().Should().HaveCount(1);
        var list = await Json(await buyer.GetAsync("/api/inspections"));
        list.GetProperty("inspections").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task An_unpaid_checkout_cannot_be_confirmed()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review = "Mechanic", idempotencyKey = Guid.NewGuid().ToString(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
        var response = await Confirm(buyer, checkout, hold, vehicle);
        response.StatusCode.Should().Be(HttpStatusCode.PaymentRequired);
        (await Json(await buyer.GetAsync("/api/inspections"))).GetProperty("inspections").GetArrayLength().Should().Be(0);
    }

    // Ownership: someone else's hold, checkout or vehicle is not found.
    [Fact]
    public async Task Holds_checkouts_and_vehicles_must_belong_to_the_buyer()
    {
        var start = await OpenWindow();
        var owner = NewBuyer();
        var vehicle = await SaveVehicle(owner);
        var hold = (await Json(await Hold(owner, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(owner, vehicle);
        var thief = NewBuyer();
        (await Confirm(thief, checkout, hold, vehicle)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var thiefVehicle = await SaveVehicle(thief);
        var thiefCheckout = await PaidCheckout(thief, thiefVehicle);
        (await Confirm(thief, thiefCheckout, hold, thiefVehicle)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Recovery: the hold expired and nobody took the slot, so confirming re-books it.
    [Fact]
    public async Task An_expired_hold_whose_slot_is_still_free_is_rebooked()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        (await Confirm(buyer, checkout, hold, vehicle)).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // Recovery: the hold expired and someone else took the slot, so the booking fails and the payment is refunded.
    [Fact]
    public async Task A_lost_slot_after_paying_is_refunded_in_full()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        (await Hold(NewBuyer(), start)).StatusCode.Should().Be(HttpStatusCode.Created);

        var response = await Confirm(buyer, checkout, hold, vehicle);
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Json(response)).GetProperty("title").GetString().Should().Be("We couldn’t hold that slot");
        (await Json(await buyer.GetAsync("/api/inspections"))).GetProperty("inspections").GetArrayLength().Should().Be(0);
        var receipt = (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0];
        receipt.GetProperty("status").GetString().Should().Be("Refunded");
    }

    // ADR 0006/0008: editing or removing the saved vehicle never changes a booked inspection.
    [Fact]
    public async Task The_inspection_keeps_the_vehicle_details_it_was_booked_with()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer, 142300);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle);
        var inspectionId = (await Json(await Confirm(buyer, checkout, hold, vehicle))).GetProperty("id").GetGuid();

        var saved = await Json(await buyer.GetAsync($"/api/vehicles/{vehicle}"));
        await buyer.PutAsJsonAsync($"/api/vehicles/{vehicle}", new { year = 2016, make = "Honda", model = "Civic", vin = saved.GetProperty("vin").GetString(), odometerKm = 999999, askingPrice = 1, sellerName = "Changed", sellerPhone = "9055550000" });
        (await buyer.DeleteAsync($"/api/vehicles/{vehicle}")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var inspection = await Json(await buyer.GetAsync($"/api/inspections/{inspectionId}"));
        inspection.GetProperty("vehicle").GetProperty("odometerKm").GetInt32().Should().Be(142300);
        inspection.GetProperty("vehicle").GetProperty("sellerName").GetString().Should().Be("Sam Whitaker");
    }

    // L2-057 and L2-058: buyers see their own, the assigned mechanic sees it, nobody else does.
    [Fact]
    public async Task Inspections_are_visible_only_to_their_buyer_and_assigned_mechanic()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var vehicle = await SaveVehicle(buyer);
        var hold = (await Json(await Hold(buyer, start))).GetProperty("holdId").GetGuid();
        var checkout = await PaidCheckout(buyer, vehicle);
        var id = (await Json(await Confirm(buyer, checkout, hold, vehicle))).GetProperty("id").GetGuid();

        (await Json(await buyer.GetAsync("/api/inspections"))).GetProperty("inspections").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).Should().Contain(id);
        (await Mechanic.GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(await Mechanic.GetAsync("/api/inspections"))).GetProperty("inspections").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).Should().Contain(id);
        (await NewBuyer().GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await _factory.ClientFor("BodyShop").GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await _factory.ClientFor("Admin").GetAsync("/api/inspections")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(null).GetAsync("/api/inspections")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Providers_cannot_hold_or_book()
    {
        (await Mechanic.PostAsJsonAsync("/api/bookings/holds", new { providerId = ApiFactory.SeededId("Mechanic"), start = NextDay() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Mechanic.PostAsJsonAsync("/api/bookings", new { checkoutId = Guid.NewGuid(), holdId = Guid.NewGuid(), vehicleId = Guid.NewGuid() })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}

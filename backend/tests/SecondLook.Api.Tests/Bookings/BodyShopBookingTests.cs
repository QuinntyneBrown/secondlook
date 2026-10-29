using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using SecondLook.Api.Tests.Bookings;

namespace SecondLook.Api.Tests.Bookings;

public class BodyShopBookingTests(ApiFactory factory) : BookingFlow(factory), IClassFixture<ApiFactory>
{
    private HttpClient Shop => Factory.ClientFor("BodyShop");
    private static readonly Guid ShopId = ApiFactory.SeededId("BodyShop");

    private async Task OpenShopWindow(DateTimeOffset start, int hours = 4) =>
        (await Shop.PostAsJsonAsync("/api/availability", new { start, end = start.AddHours(hours) })).StatusCode.Should().Be(HttpStatusCode.Created);

    private async Task<JsonElement[]> SlotsOfKind(HttpClient buyer, string kind, DateTimeOffset from, int hours)
    {
        var url = $"/api/slots?kind={kind}&from={Uri.EscapeDataString(from.ToString("O"))}&to={Uri.EscapeDataString(from.AddHours(hours).ToString("O"))}";
        return (await Json(await buyer.GetAsync(url))).GetProperty("slots").EnumerateArray().ToArray();
    }

    private Task<HttpResponseMessage> HoldBoth(HttpClient buyer, DateTimeOffset start) =>
        buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start, bodyShopId = ShopId });

    private async Task<(Guid checkout, Guid vehicle)> PaidCheckout(HttpClient buyer, string review)
    {
        var vehicle = (await Json(await buyer.PostAsJsonAsync("/api/vehicles", new { year = 2016, make = "Honda", model = "Civic", vin = NewVin(), odometerKm = 100000, askingPrice = 7000, sellerName = "Sam Whitaker", sellerPhone = "9055550142" }))).GetProperty("id").GetGuid();
        var checkout = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
        var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Bo", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
        (await buyer.PostAsJsonAsync($"/api/checkouts/{checkout}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
        return (checkout, vehicle);
    }

    // ADR 0011: a combined call is offered only at starts where a mechanic and a body shop are both free.
    [Fact]
    public async Task Combined_slots_need_a_mechanic_and_a_body_shop_at_the_same_start()
    {
        var start = NextDay();
        await OpenWindow(2, start);                       // mechanic: start .. start+2h
        await OpenShopWindow(start.AddHours(1), 2);       // shop: start+1h .. start+3h
        var slots = await SlotsOfKind(NewBuyer(), "Both", start, 4);
        var starts = slots.Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        starts.Should().Equal(start.AddMinutes(60), start.AddMinutes(90));
        slots[0].GetProperty("providerName").GetString().Should().Be("Maya Mechanic");
        slots[0].GetProperty("bodyShopName").GetString().Should().Be("Bo Bodyshop");
        slots[0].GetProperty("bodyShopId").GetGuid().Should().Be(ShopId);
    }

    [Fact]
    public async Task Body_shop_slots_come_from_approved_shops_only()
    {
        var start = NextDay();
        await OpenShopWindow(start, 1);
        var buyer = NewBuyer();
        (await SlotsOfKind(buyer, "BodyShop", start, 2)).Should().NotBeEmpty().And.OnlyContain(s => s.GetProperty("kind").GetString() == "BodyShop");
        var admin = Factory.ClientFor("Admin");
        await admin.PostAsync($"/api/admin/providers/{ShopId}/deactivate", null);
        (await SlotsOfKind(buyer, "BodyShop", start, 2)).Should().BeEmpty();
        (await SlotsOfKind(buyer, "Both", start, 2)).Should().BeEmpty();
        await admin.PostAsync($"/api/admin/providers/{ShopId}/approve", null);
    }

    // A combined hold takes both slots; either alone fails the whole hold and gives back what was taken.
    [Fact]
    public async Task A_combined_hold_takes_both_slots_all_or_nothing()
    {
        var start = NextDay();
        await OpenWindow(2, start);
        await OpenShopWindow(start, 2);
        var buyer = NewBuyer();
        var hold = await HoldBoth(buyer, start);
        hold.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await Json(hold);
        body.GetProperty("bodyShopHoldId").GetGuid().Should().NotBeEmpty();
        (await FreeSlots(buyer, start, 2)).Should().NotContain(start);
        (await SlotsOfKind(buyer, "BodyShop", start, 2)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().NotContain(start);

        // The shop is taken at start+30; a combined hold there fails and releases the mechanic's slot.
        (await Shop.PostAsJsonAsync("/api/bookings/holds", new { providerId = ShopId, start = start.AddMinutes(30) })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var other = NewBuyer();
        (await other.PostAsJsonAsync("/api/bookings/holds", new { providerId = ShopId, start = start.AddMinutes(30) })).StatusCode.Should().Be(HttpStatusCode.Created);
        var clash = await NewBuyer().PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start = start.AddMinutes(30), bodyShopId = ShopId });
        clash.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await FreeSlots(buyer, start, 2)).Should().Contain(start.AddMinutes(30));
    }

    // ADR 0011: both providers are assigned and both see the inspection; the buyer's review and price persist.
    [Fact]
    public async Task A_combined_booking_is_assigned_to_both_providers()
    {
        var start = NextDay();
        await OpenWindow(2, start);
        await OpenShopWindow(start, 2);
        var buyer = NewBuyer();
        var hold = await Json(await HoldBoth(buyer, start));
        var (checkout, vehicle) = await PaidCheckout(buyer, "Both");
        var confirmed = await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold.GetProperty("holdId").GetGuid(), bodyShopHoldId = hold.GetProperty("bodyShopHoldId").GetGuid(), vehicleId = vehicle });
        confirmed.StatusCode.Should().Be(HttpStatusCode.Created);
        var inspection = await Json(confirmed);
        inspection.GetProperty("review").GetString().Should().Be("Both");
        inspection.GetProperty("amountCents").GetInt32().Should().Be(7000);
        inspection.GetProperty("mechanicName").GetString().Should().Be("Maya Mechanic");
        inspection.GetProperty("bodyShopName").GetString().Should().Be("Bo Bodyshop");
        var id = inspection.GetProperty("id").GetGuid();
        (await Mechanic.GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Shop.GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await NewBuyer().GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await SlotsOfKind(buyer, "Both", start, 2)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().NotContain(start);
    }

    // A body shop review alone is assigned to the shop only.
    [Fact]
    public async Task A_body_shop_only_booking_is_assigned_to_the_shop_alone()
    {
        var start = NextDay();
        await OpenShopWindow(start, 1);
        var buyer = NewBuyer();
        var hold = await Json(await buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = ShopId, start }));
        var (checkout, vehicle) = await PaidCheckout(buyer, "BodyShop");
        var confirmed = await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold.GetProperty("holdId").GetGuid(), vehicleId = vehicle });
        confirmed.StatusCode.Should().Be(HttpStatusCode.Created);
        var inspection = await Json(confirmed);
        inspection.GetProperty("review").GetString().Should().Be("BodyShop");
        inspection.GetProperty("mechanicName").ValueKind.Should().Be(JsonValueKind.Null);
        inspection.GetProperty("bodyShopName").GetString().Should().Be("Bo Bodyshop");
        var id = inspection.GetProperty("id").GetGuid();
        (await Shop.GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Mechanic.GetAsync($"/api/inspections/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // The holds must match the review that was paid for.
    [Fact]
    public async Task The_holds_must_match_the_review()
    {
        var start = NextDay();
        await OpenWindow(2, start);
        await OpenShopWindow(start, 2);
        var buyer = NewBuyer();
        // Both reviewed but only the mechanic held.
        var mechanicOnly = await Json(await buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start }));
        var (checkout, vehicle) = await PaidCheckout(buyer, "Both");
        (await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = mechanicOnly.GetProperty("holdId").GetGuid(), vehicleId = vehicle })).StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Mechanic reviewed but a body shop slot held.
        var buyer2 = NewBuyer();
        var shopHold = await Json(await buyer2.PostAsJsonAsync("/api/bookings/holds", new { providerId = ShopId, start = start.AddMinutes(60) }));
        var (checkout2, vehicle2) = await PaidCheckout(buyer2, "Mechanic");
        (await buyer2.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout2, holdId = shopHold.GetProperty("holdId").GetGuid(), vehicleId = vehicle2 })).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // Cancelling a combined inspection releases both slots and refunds once.
    [Fact]
    public async Task Cancelling_a_combined_inspection_releases_both_slots()
    {
        var start = NextDay();
        await OpenWindow(2, start);
        await OpenShopWindow(start, 2);
        var buyer = NewBuyer();
        var hold = await Json(await HoldBoth(buyer, start));
        var (checkout, vehicle) = await PaidCheckout(buyer, "Both");
        var id = (await Json(await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold.GetProperty("holdId").GetGuid(), bodyShopHoldId = hold.GetProperty("bodyShopHoldId").GetGuid(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await SlotsOfKind(buyer, "Both", start, 2)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().Contain(start);
        (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0].GetProperty("status").GetString().Should().Be("Refunded");
    }

    // Rescheduling a combined inspection moves both providers to a time they share.
    [Fact]
    public async Task Rescheduling_a_combined_inspection_moves_both_slots()
    {
        var start = NextDay();
        await OpenWindow(2, start);
        await OpenShopWindow(start, 2);
        var buyer = NewBuyer();
        var hold = await Json(await HoldBoth(buyer, start));
        var (checkout, vehicle) = await PaidCheckout(buyer, "Both");
        var id = (await Json(await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold.GetProperty("holdId").GetGuid(), bodyShopHoldId = hold.GetProperty("bodyShopHoldId").GetGuid(), vehicleId = vehicle }))).GetProperty("id").GetGuid();

        var offered = (await Json(await buyer.GetAsync($"/api/inspections/{id}/reschedule-slots"))).GetProperty("slots").EnumerateArray().Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        offered.Should().Contain(start.AddHours(1));
        var target = start.AddHours(1);
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = target })).StatusCode.Should().Be(HttpStatusCode.OK);
        var free = (await SlotsOfKind(buyer, "Both", start, 3)).Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        free.Should().Contain(start).And.NotContain(target);
        (await SlotsOfKind(buyer, "BodyShop", start, 3)).Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().Contain(start).And.NotContain(target);
    }
}

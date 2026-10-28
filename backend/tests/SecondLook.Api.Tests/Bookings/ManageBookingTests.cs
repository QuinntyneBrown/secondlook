using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Bookings;

/// <summary>Booking helpers shared by the reschedule and cancel tests.</summary>
public abstract class BookingFlow(ApiFactory factory)
{
    protected readonly ApiFactory Factory = factory;
    protected const string Visa = "4242 4242 4242 4242";
    private static int _day = 400;
    private static int _vin = 700000;
    protected static DateTimeOffset NextDay() => new(DateTimeOffset.UtcNow.Date.AddDays(Interlocked.Increment(ref _day)).AddHours(14), TimeSpan.Zero);
    protected static string NewVin() => $"2HGFC2F59GH{Interlocked.Increment(ref _vin)}";
    protected HttpClient Mechanic => Factory.ClientFor("Mechanic");
    protected static Task<JsonElement> Json(HttpResponseMessage r) => r.Content.ReadFromJsonAsync<JsonElement>();
    protected static readonly Guid MechanicId = ApiFactory.SeededId("Mechanic");

    protected HttpClient NewBuyer()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.NewGuid();
        db.Users.Add(new User { Id = id, Email = $"mb{id:N}@example.test", DisplayName = "Mo Mover", Role = UserRole.Buyer, EmailVerified = true });
        db.SaveChanges();
        return Factory.ClientFor("Buyer", id);
    }

    protected async Task<DateTimeOffset> OpenWindow(int hours = 4, DateTimeOffset? at = null)
    {
        var start = at ?? NextDay();
        (await Mechanic.PostAsJsonAsync("/api/availability", new { start, end = start.AddHours(hours) })).StatusCode.Should().Be(HttpStatusCode.Created);
        return start;
    }

    /// <summary>Books the slot at <paramref name="start"/> and returns the inspection id.</summary>
    protected async Task<Guid> Book(HttpClient buyer, DateTimeOffset start, string review = "Mechanic")
    {
        var vehicle = (await Json(await buyer.PostAsJsonAsync("/api/vehicles", new { vin = NewVin(), odometerKm = 100000, askingPrice = 7000, sellerName = "Sam Whitaker", sellerPhone = "9055550142" }))).GetProperty("id").GetGuid();
        var hold = (await Json(await buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start }))).GetProperty("holdId").GetGuid();
        var checkout = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
        var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Mo", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
        (await buyer.PostAsJsonAsync($"/api/checkouts/{checkout}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
        var confirmed = await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold, vehicleId = vehicle });
        confirmed.StatusCode.Should().Be(HttpStatusCode.Created);
        return (await Json(confirmed)).GetProperty("id").GetGuid();
    }

    protected async Task<DateTimeOffset[]> FreeSlots(HttpClient buyer, DateTimeOffset from, int hours)
    {
        var url = $"/api/slots?from={Uri.EscapeDataString(from.ToString("O"))}&to={Uri.EscapeDataString(from.AddHours(hours).ToString("O"))}";
        return (await Json(await buyer.GetAsync(url))).GetProperty("slots").EnumerateArray()
            .Where(s => s.GetProperty("providerId").GetGuid() == MechanicId).Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
    }
}

public class ManageBookingTests(ApiFactory factory) : BookingFlow(factory), IClassFixture<ApiFactory>
{
    // L2-036 AC1: the buyer is offered the same mechanic's free slots.
    [Fact]
    public async Task Reschedule_slots_are_the_same_mechanics_free_times()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var response = await buyer.GetAsync($"/api/inspections/{id}/reschedule-slots");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var slots = (await Json(response)).GetProperty("slots").EnumerateArray().Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        slots.Should().Contain(start.AddMinutes(30)).And.NotContain(start);
    }

    // L2-036 AC3: the call moves, the old slot is freed and the new one taken.
    [Fact]
    public async Task Rescheduling_moves_the_call_and_swaps_the_slots()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var target = start.AddHours(2);
        var response = await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = target });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(response)).GetProperty("start").GetDateTimeOffset().Should().Be(target);

        var free = await FreeSlots(buyer, start, 4);
        free.Should().Contain(start).And.NotContain(target);
        (await Json(await buyer.GetAsync($"/api/inspections/{id}"))).GetProperty("start").GetDateTimeOffset().Should().Be(target);
    }

    // L2-036 AC4: a slot someone else took leaves the original booking untouched.
    [Fact]
    public async Task Rescheduling_into_a_taken_slot_keeps_the_original_time()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var target = start.AddHours(2);
        (await NewBuyer().PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start = target })).StatusCode.Should().Be(HttpStatusCode.Created);
        var response = await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = target });
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Json(response)).GetProperty("title").GetString().Should().Be("We couldn’t move the call");
        (await Json(await buyer.GetAsync($"/api/inspections/{id}"))).GetProperty("start").GetDateTimeOffset().Should().Be(start);
        (await FreeSlots(buyer, start, 4)).Should().NotContain(start);
    }

    [Fact]
    public async Task Rescheduling_outside_the_mechanics_availability_is_a_conflict()
    {
        var start = await OpenWindow(1);
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = start.AddDays(3) })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Json(await buyer.GetAsync($"/api/inspections/{id}"))).GetProperty("start").GetDateTimeOffset().Should().Be(start);
    }

    // Undo is just another reschedule back to the original time.
    [Fact]
    public async Task A_reschedule_can_be_undone_while_the_old_time_is_free()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = start.AddHours(2) });
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start })).StatusCode.Should().Be(HttpStatusCode.OK);
        (await FreeSlots(buyer, start, 4)).Should().NotContain(start).And.Contain(start.AddHours(2));
    }

    // L2-057: only the owner can reschedule; providers and others are refused.
    [Fact]
    public async Task Only_the_owner_can_reschedule_or_cancel()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var other = NewBuyer();
        (await other.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = start.AddHours(2) })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.GetAsync($"/api/inspections/{id}/reschedule-slots")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Mechanic.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Json(await buyer.GetAsync($"/api/inspections/{id}"))).GetProperty("status").GetString().Should().Be("Scheduled");
    }

    // L2-037 AC3: a reason is required.
    [Fact]
    public async Task Cancelling_needs_a_valid_reason()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var response = await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Json(response)).GetProperty("errors").GetProperty("reason")[0].GetString().Should().Be("Choose a reason so we can improve.");
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Whatever" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // L2-037 AC4, L2-038, L2-032 AC3: far ahead is a full refund, the slot is released, and the inspection is cancelled.
    [Fact]
    public async Task Cancelling_well_ahead_refunds_in_full_and_releases_the_slot()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var before = await Json(await buyer.GetAsync($"/api/inspections/{id}"));
        before.GetProperty("refundPreviewCents").GetInt32().Should().Be(5000);
        before.GetProperty("cardLast4").GetString().Should().Be("4242");

        var response = await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "DifferentCar" });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var cancelled = await Json(response);
        cancelled.GetProperty("status").GetString().Should().Be("Cancelled");
        cancelled.GetProperty("refundedCents").GetInt32().Should().Be(5000);
        cancelled.GetProperty("retainedCents").GetInt32().Should().Be(0);

        (await FreeSlots(buyer, start, 4)).Should().Contain(start);
        var receipt = (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0];
        receipt.GetProperty("status").GetString().Should().Be("Refunded");
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = start.AddHours(2) })).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-029 spirit: cancelling again, even simultaneously, refunds once.
    [Fact]
    public async Task Repeated_and_concurrent_cancellations_refund_once()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })));
        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        (await Task.WhenAll(responses.Select(Json))).Should().OnlyContain(j => j.GetProperty("refundedCents").GetInt32() == 5000);
        var receipts = (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts");
        receipts.GetArrayLength().Should().Be(1);
        receipts[0].GetProperty("status").GetString().Should().Be("Refunded");
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // L2-038: the cancelled inspection stays readable with its refund.
    [Fact]
    public async Task A_cancelled_inspection_shows_its_refund()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "SellerBackedOut" });
        var read = await Json(await buyer.GetAsync($"/api/inspections/{id}"));
        read.GetProperty("status").GetString().Should().Be("Cancelled");
        read.GetProperty("cancelledAt").GetDateTimeOffset().Should().BeCloseTo(Factory.Clock.GetUtcNow(), TimeSpan.FromMinutes(2));
        read.GetProperty("refundedCents").GetInt32().Should().Be(5000);
        read.GetProperty("cardLast4").GetString().Should().Be("4242");
    }
}

/// <summary>Runs on its own host because it moves the clock close to the call.</summary>
public class LateCancellationTests(ApiFactory factory) : BookingFlow(factory), IClassFixture<ApiFactory>
{
    // L2-032 AC4: under 2 hours before the call, $25 is kept.
    [Fact]
    public async Task Cancelling_within_two_hours_keeps_the_fee()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        Factory.Clock.Advance(start - Factory.Clock.GetUtcNow() - TimeSpan.FromMinutes(90));
        var preview = await Json(await buyer.GetAsync($"/api/inspections/{id}"));
        preview.GetProperty("refundPreviewCents").GetInt32().Should().Be(2500);
        var cancelled = await Json(await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "PriceChanged" }));
        cancelled.GetProperty("refundedCents").GetInt32().Should().Be(2500);
        cancelled.GetProperty("retainedCents").GetInt32().Should().Be(2500);
        (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0].GetProperty("status").GetString().Should().Be("Partially refunded");
    }

    // Once the call has started it can no longer be moved or cancelled.
    [Fact]
    public async Task A_call_that_has_started_cannot_be_moved_or_cancelled()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        Factory.Clock.Advance(start - Factory.Clock.GetUtcNow() + TimeSpan.FromMinutes(5));
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/reschedule", new { start = start.AddHours(2) })).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}

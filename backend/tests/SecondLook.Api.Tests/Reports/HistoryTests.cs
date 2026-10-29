using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Inspections;
using SecondLook.Domain.Payments;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Reports;

/// <summary>
/// The buyer's inspection history (ADR 0016): active and past inspections, with the estimate summary, in pages. This fixture moves
/// the clock to reach call times.
/// </summary>
public class HistoryTests(ApiFactory factory) : ReportFlow(factory), IClassFixture<ApiFactory>
{
    private static Task<HttpResponseMessage> History(HttpClient who, string tab, string? page = null) =>
        who.GetAsync($"/api/inspections/history?tab={tab}" + (page is null ? "" : $"&page={page}"));

    private static async Task<JsonElement> Of(HttpClient who, string tab, string? page = null) => await Json(await History(who, tab, page));

    private static Guid[] Ids(JsonElement history) => history.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetGuid()).ToArray();

    private (HttpClient client, Guid id) NewBuyerWithId()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.NewGuid();
        db.Users.Add(new User { Id = id, Email = $"hb{id:N}@example.test", DisplayName = "Hal History", Role = UserRole.Buyer, EmailVerified = true });
        db.SaveChanges();
        return (Factory.ClientFor("Buyer", id), id);
    }

    /// <summary>Inserts <paramref name="count"/> cancelled inspections for a buyer, newest last, for the long-list tests.</summary>
    private void InsertCancelled(Guid buyerId, int count)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var origin = Factory.Clock.GetUtcNow().AddDays(-90);
        for (var n = 0; n < count; n++)
        {
            var start = origin.AddHours(n);
            db.Inspections.Add(new Inspection
            {
                Id = Guid.NewGuid(), BuyerId = buyerId, MechanicId = MechanicId, CheckoutId = Guid.NewGuid(), PaymentId = Guid.NewGuid(), SlotReservationId = Guid.NewGuid(),
                Status = InspectionStatus.Cancelled, Review = ReviewType.Mechanic, StartUtc = start, EndUtc = start.AddMinutes(30), AmountCents = 5000, CreatedAt = origin,
                CancelledAt = origin.AddMinutes(5), RefundedCents = 5000, Vin = $"LONGLIST{n:D9}", OdometerKm = 1000 + n, AskingPrice = 5000, SellerName = "Sam Whitaker", SellerPhone = "9055550142",
            });
        }
        db.SaveChanges();
    }

    // L2-019, L2-022: inspections not finished with are Active; completed and cancelled ones are Past.
    [Fact]
    public async Task Inspections_are_split_into_active_and_past_with_counts()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var upcoming = await BookedCar(buyer, start.AddMinutes(90), endCall: false);
        var cancelled = await BookedCar(buyer, start.AddMinutes(60), endCall: false);
        (await buyer.PostAsJsonAsync($"/api/inspections/{cancelled}/cancel", new { reason = "Other" })).EnsureSuccessStatusCode();
        var done = await BookedCar(buyer, start);
        await Estimated(done, 30000, 45000);
        var waiting = await BookedCar(buyer, start.AddMinutes(30));

        var active = await Of(buyer, "Active");
        Ids(active).Should().Equal(waiting, upcoming);
        active.GetProperty("activeCount").GetInt32().Should().Be(2);
        active.GetProperty("pastCount").GetInt32().Should().Be(2);
        active.GetProperty("total").GetInt32().Should().Be(2);
        var rows = active.GetProperty("items").EnumerateArray().ToArray();
        rows[0].GetProperty("phase").GetString().Should().Be("CallEnded");
        rows[1].GetProperty("phase").GetString().Should().Be("Upcoming");

        var past = await Of(buyer, "Past");
        Ids(past).Should().Equal(cancelled, done).And.HaveCount(2);
        past.GetProperty("total").GetInt32().Should().Be(2);
        var pastRows = past.GetProperty("items").EnumerateArray().ToArray();
        pastRows.Select(r => r.GetProperty("phase").GetString()).Should().BeEquivalentTo("Cancelled", "ReportReady");
    }

    // L2-021 AC4: a row's estimate says what the mechanic found: required repairs with their cost, or recommended, or passes.
    [Fact]
    public async Task A_delivered_inspection_carries_the_estimate_summary()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var required = await BookedCar(buyer, start);
        (await Submit(required, Finding("Brakes", "Required", 30000, 45000), Finding("Tires", "Required", 20000, 30000), Finding("Wipers", "Recommended", 1000, 2000))).EnsureSuccessStatusCode();
        var recommended = await BookedCar(buyer, start.AddMinutes(30));
        (await Submit(recommended, Finding("Wipers", "Recommended", 1000, 2000), Finding("Steering", "Passes"))).EnsureSuccessStatusCode();
        var passes = await BookedCar(buyer, start.AddMinutes(60));
        (await Submit(passes, Finding("Steering", "Passes"))).EnsureSuccessStatusCode();

        var rows = (await Of(buyer, "Past")).GetProperty("items").EnumerateArray().ToDictionary(r => r.GetProperty("id").GetGuid());
        var a = rows[required].GetProperty("estimate");
        a.GetProperty("state").GetString().Should().Be("Required");
        a.GetProperty("requiredCount").GetInt32().Should().Be(2);
        a.GetProperty("costMinCents").GetInt32().Should().Be(50000);
        a.GetProperty("costMaxCents").GetInt32().Should().Be(75000);
        rows[recommended].GetProperty("estimate").GetProperty("state").GetString().Should().Be("Recommended");
        rows[passes].GetProperty("estimate").GetProperty("state").GetString().Should().Be("Passes");
    }

    // ADR 0014: a review with both providers is finished with only when both parts are in.
    [Fact]
    public async Task A_combined_review_moves_to_past_only_when_both_parts_are_delivered()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await Submit(id, Finding("Brakes", "Required", 1000, 2000))).EnsureSuccessStatusCode();
        Ids(await Of(buyer, "Active")).Should().Contain(id);
        Ids(await Of(buyer, "Past")).Should().NotContain(id);

        (await SubmitShop(id, Finding("Dent", "Required", 5000, 9000))).EnsureSuccessStatusCode();
        Ids(await Of(buyer, "Past")).Should().Contain(id);
        Ids(await Of(buyer, "Active")).Should().NotContain(id);
    }

    // L2-021 AC1, AC2: 20 to a page, with totals, and out-of-range pages are harmless.
    [Fact]
    public async Task A_long_list_is_paged_twenty_at_a_time()
    {
        var (buyer, id) = NewBuyerWithId();
        InsertCancelled(id, 45);

        var first = await Of(buyer, "Past");
        first.GetProperty("total").GetInt32().Should().Be(45);
        first.GetProperty("pastCount").GetInt32().Should().Be(45);
        first.GetProperty("page").GetInt32().Should().Be(1);
        first.GetProperty("pageSize").GetInt32().Should().Be(20);
        first.GetProperty("items").GetArrayLength().Should().Be(20);

        var second = await Of(buyer, "Past", "2");
        second.GetProperty("items").GetArrayLength().Should().Be(20);
        (await Of(buyer, "Past", "3")).GetProperty("items").GetArrayLength().Should().Be(5);
        Ids(first).Intersect(Ids(second)).Should().BeEmpty();

        // Newest first; a page past the end is empty, and a bad page is the first page.
        var vins = first.GetProperty("items").EnumerateArray().Select(r => r.GetProperty("vin").GetString()).ToArray();
        vins[0].Should().Be("LONGLIST000000044");
        // L2-085 AC7: an inspection booked before make and model were recorded is named by its VIN.
        first.GetProperty("items")[0].GetProperty("vehicleName").GetString().Should().Be("LONGLIST000000044");
        (await Of(buyer, "Past", "9")).GetProperty("items").GetArrayLength().Should().Be(0);
        (await Of(buyer, "Past", "0")).GetProperty("page").GetInt32().Should().Be(1);
        (await Of(buyer, "Past", "abc")).GetProperty("page").GetInt32().Should().Be(1);
    }

    // L2-035: a cancelled inspection keeps what it was booked with, so history stays readable.
    [Fact]
    public async Task A_cancelled_inspection_keeps_its_snapshot()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var id = await BookedCar(buyer, start, endCall: false);
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "DifferentCar" })).EnsureSuccessStatusCode();
        var row = (await Of(buyer, "Past")).GetProperty("items")[0];
        row.GetProperty("phase").GetString().Should().Be("Cancelled");
        row.GetProperty("askingPriceCents").GetInt32().Should().Be(700000);
        row.GetProperty("mechanicName").GetString().Should().Be("Maya Mechanic");
        row.GetProperty("refundedCents").GetInt32().Should().BeGreaterThan(0);
        row.GetProperty("estimate").ValueKind.Should().Be(JsonValueKind.Null);
        row.GetProperty("cancelledAt").ValueKind.Should().Be(JsonValueKind.String);
    }

    // L2-057: only the buyer's own inspections; other roles and anonymous callers are refused.
    [Fact]
    public async Task Only_the_buyers_own_inspections_are_listed()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var mine = await BookedCar(buyer, start, endCall: false);
        Ids(await Of(buyer, "Active")).Should().Equal(mine);

        var other = NewBuyer();
        var none = await Of(other, "Active");
        none.GetProperty("items").GetArrayLength().Should().Be(0);
        none.GetProperty("activeCount").GetInt32().Should().Be(0);
        (await Mechanic.GetAsync("/api/inspections/history?tab=Active")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BodyShop.GetAsync("/api/inspections/history?tab=Past")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Factory.ClientFor(null).GetAsync("/api/inspections/history?tab=Active")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // A tab that is not Active or Past is a bad request rather than a silent default.
    [Fact]
    public async Task An_unknown_tab_is_refused()
    {
        (await History(NewBuyer(), "Archived")).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}

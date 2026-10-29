using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Reports;

/// <summary>
/// Comparing the cars a buyer has had inspected in one pricing window (ADR 0015). This fixture moves the clock to reach call times.
/// </summary>
public class ComparisonTests(ApiFactory factory) : ReportFlow(factory), IClassFixture<ApiFactory>
{
    /// <summary>Books another car for the same buyer at <paramref name="start"/>, holds its call and ends it.</summary>
    private async Task<Guid> BookedCar(HttpClient buyer, DateTimeOffset start, bool endCall = true)
    {
        var id = await Book(buyer, start);
        if (!endCall) return id;
        var wait = start - TimeSpan.FromMinutes(5) - Factory.Clock.GetUtcNow();
        if (wait > TimeSpan.Zero) Factory.Clock.Advance(wait);
        (await buyer.PostAsync($"/api/calls/{id}/join", null)).EnsureSuccessStatusCode();
        (await buyer.PostAsync($"/api/calls/{id}/end", null)).EnsureSuccessStatusCode();
        return id;
    }

    private async Task Estimated(Guid id, int min, int max) =>
        (await Submit(id, Finding("Brakes", "Required", min, max))).EnsureSuccessStatusCode();

    private static async Task<JsonElement> Compare(HttpClient who) => await Json(await who.GetAsync("/api/comparisons"));

    private static string[] Vins(JsonElement c) => c.GetProperty("columns").EnumerateArray().Select(x => x.GetProperty("vin").GetString()!).ToArray();

    // L2-051 AC1-AC3: cars with an estimate are lined up lowest all-in first, and the lowest is marked.
    [Fact]
    public async Task Cars_with_an_estimate_are_ordered_lowest_all_in_first_and_the_lowest_is_marked()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var a = await BookedCar(buyer, start);
        await Estimated(a, 100000, 200000);
        var b = await BookedCar(buyer, start.AddMinutes(30));
        await Estimated(b, 30000, 50000);
        var c = await BookedCar(buyer, start.AddMinutes(60));
        await Estimated(c, 80000, 90000);

        var comparison = await Compare(buyer);
        var columns = comparison.GetProperty("columns").EnumerateArray().ToArray();
        columns.Select(x => x.GetProperty("inspectionId").GetGuid()).Should().Equal(b, c, a);
        columns.Select(x => x.GetProperty("lowest").GetBoolean()).Should().Equal(true, false, false);

        var first = columns[0];
        first.GetProperty("status").GetString().Should().Be("Ready");
        first.GetProperty("askingPriceCents").GetInt32().Should().Be(700000);
        first.GetProperty("costMinCents").GetInt32().Should().Be(30000);
        first.GetProperty("costMaxCents").GetInt32().Should().Be(50000);
        first.GetProperty("allInMinCents").GetInt32().Should().Be(730000);
        first.GetProperty("allInMaxCents").GetInt32().Should().Be(750000);
        first.GetProperty("odometerKm").GetInt32().Should().BeGreaterThan(0);
        comparison.GetProperty("readyCount").GetInt32().Should().Be(3);
        comparison.GetProperty("window").GetProperty("open").GetBoolean().Should().BeTrue();
    }

    // L2-051: the all-in total of every column is the asking price plus the same report's certification cost.
    [Fact]
    public async Task Each_column_matches_its_report()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var a = await BookedCar(buyer, start);
        await Estimated(a, 45000, 65000);
        var report = await Json(await buyer.GetAsync($"/api/inspections/{a}/report"));
        var column = (await Compare(buyer)).GetProperty("columns")[0];
        column.GetProperty("costMinCents").GetInt32().Should().Be(report.GetProperty("costMinCents").GetInt32());
        column.GetProperty("allInMaxCents").GetInt32().Should().Be(report.GetProperty("allInMaxCents").GetInt32());
    }

    // L2-051 AC3: cars with the same total are all the lowest; a lone ready car is not "lowest" of anything.
    [Fact]
    public async Task Equal_totals_share_the_lowest_mark_and_a_lone_estimate_is_not_marked()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var a = await BookedCar(buyer, start);
        await Estimated(a, 20000, 30000);
        (await Compare(buyer)).GetProperty("columns")[0].GetProperty("lowest").GetBoolean().Should().BeFalse();

        var b = await BookedCar(buyer, start.AddMinutes(30));
        await Estimated(b, 20000, 30000);
        var c = await BookedCar(buyer, start.AddMinutes(60));
        await Estimated(c, 90000, 99000);
        var columns = (await Compare(buyer)).GetProperty("columns").EnumerateArray().ToArray();
        columns.Select(x => x.GetProperty("lowest").GetBoolean()).Should().Equal(true, true, false);
    }

    // L2-052: a car whose estimate is not written yet is shown as pending, after the cars that can be compared.
    [Fact]
    public async Task A_car_without_an_estimate_is_pending_and_comes_after_the_ready_ones()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var waiting = await BookedCar(buyer, start, endCall: false);
        var ready = await BookedCar(buyer, start.AddMinutes(30));
        await Estimated(ready, 50000, 60000);

        var columns = (await Compare(buyer)).GetProperty("columns").EnumerateArray().ToArray();
        columns.Select(x => x.GetProperty("inspectionId").GetGuid()).Should().Equal(ready, waiting);
        var pending = columns[1];
        pending.GetProperty("status").GetString().Should().Be("Pending");
        pending.GetProperty("costMinCents").ValueKind.Should().Be(JsonValueKind.Null);
        pending.GetProperty("allInMinCents").ValueKind.Should().Be(JsonValueKind.Null);
        pending.GetProperty("lowest").GetBoolean().Should().BeFalse();
        (await Compare(buyer)).GetProperty("readyCount").GetInt32().Should().Be(1);
    }

    // L2-052: a review with the body shop alone has no certification estimate to compare.
    [Fact]
    public async Task A_body_shop_only_review_has_no_estimate_to_compare()
    {
        var (buyer, _) = await FinishedBodyShopOnlyCall();
        var column = (await Compare(buyer)).GetProperty("columns")[0];
        column.GetProperty("status").GetString().Should().Be("NoEstimate");
        column.GetProperty("costMinCents").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // L2-052 AC2: with one car there is nothing to line up yet; the page decides, the API says what there is.
    [Fact]
    public async Task One_car_is_returned_alone_and_a_buyer_with_none_gets_an_empty_comparison()
    {
        var buyer = NewBuyer();
        var none = await Compare(buyer);
        none.GetProperty("columns").GetArrayLength().Should().Be(0);
        none.GetProperty("window").ValueKind.Should().Be(JsonValueKind.Null);

        var start = await OpenWindow(4);
        await BookedCar(buyer, start, endCall: false);
        (await Compare(buyer)).GetProperty("columns").GetArrayLength().Should().Be(1);
    }

    // L2-057: only the buyer's own cars; other roles and anonymous callers are refused.
    [Fact]
    public async Task Only_the_buyers_own_cars_are_compared()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var a = await BookedCar(buyer, start);
        await Estimated(a, 10000, 20000);
        var mine = Vins(await Compare(buyer));
        mine.Should().HaveCount(1);

        var other = NewBuyer();
        (await Compare(other)).GetProperty("columns").GetArrayLength().Should().Be(0);
        (await Mechanic.GetAsync("/api/comparisons")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BodyShop.GetAsync("/api/comparisons")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Factory.ClientFor("Admin").GetAsync("/api/comparisons")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Factory.ClientFor(null).GetAsync("/api/comparisons")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // A cancelled inspection is not a car in the comparison.
    [Fact]
    public async Task A_cancelled_inspection_is_left_out()
    {
        var start = await OpenWindow(4);
        var buyer = NewBuyer();
        var a = await BookedCar(buyer, start, endCall: false);
        var b = await BookedCar(buyer, start.AddMinutes(30), endCall: false);
        (await buyer.PostAsJsonAsync($"/api/inspections/{a}/cancel", new { reason = "Other" })).EnsureSuccessStatusCode();
        var columns = (await Compare(buyer)).GetProperty("columns").EnumerateArray().ToArray();
        columns.Select(x => x.GetProperty("inspectionId").GetGuid()).Should().Equal(b);
    }
}

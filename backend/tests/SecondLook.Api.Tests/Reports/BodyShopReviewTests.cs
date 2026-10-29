using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Reports;

/// <summary>
/// The body shop's side of a review (ADR 0014): it joins the same call, writes its own findings after it, and the buyer reads
/// them beside the mechanic's. Each part has its own author and its own completion. This fixture moves the clock.
/// </summary>
public class BodyShopReviewTests(ApiFactory factory) : ReportFlow(factory), IClassFixture<ApiFactory>
{
    private static readonly object[] ShopFindings =
    [
        Finding("Rear quarter panel dent", "Required", 80000, 120000, "Needs filler and paint."),
        Finding("Front bumper paint", "Recommended", 30000, 50000),
        Finding("Hood", "Passes"),
    ];

    private async Task<JsonElement> ReportOf(HttpClient who, Guid id) => await Json(await who.GetAsync($"/api/inspections/{id}/report"));

    // L2-062 AC1, AC2: the body shop's findings reach the buyer, as its own part of the report.
    [Fact]
    public async Task Body_shop_findings_reach_the_buyer_separately_from_the_mechanics()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await Submit(id, Finding("Front brake pads", "Required", 30000, 45000))).EnsureSuccessStatusCode();
        (await SubmitShop(id, ShopFindings)).StatusCode.Should().Be(HttpStatusCode.OK);

        var report = await ReportOf(buyer, id);
        var shop = report.GetProperty("bodyShop");
        shop.GetProperty("status").GetString().Should().Be("Ready");
        shop.GetProperty("reviewerName").GetString().Should().Be("Bo Bodyshop");
        shop.GetProperty("findings").EnumerateArray().Select(f => f.GetProperty("title").GetString()).Should()
            .Equal("Rear quarter panel dent", "Front bumper paint", "Hood");
        shop.GetProperty("findings")[0].GetProperty("minCents").GetInt32().Should().Be(80000);

        // The mechanic's findings and the certification totals are untouched: body repairs are separate.
        report.GetProperty("findings").EnumerateArray().Select(f => f.GetProperty("title").GetString()).Should().Equal("Front brake pads");
        report.GetProperty("costMinCents").GetInt32().Should().Be(30000);
        report.GetProperty("costMaxCents").GetInt32().Should().Be(45000);
        report.GetProperty("mechanicReady").GetBoolean().Should().BeTrue();
    }

    // L2-062: each part is complete on its own; one does not wait for, or overwrite, the other.
    [Fact]
    public async Task Each_part_is_complete_on_its_own()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await buyer.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.Conflict);

        (await SubmitShop(id, ShopFindings)).EnsureSuccessStatusCode();
        var first = await ReportOf(buyer, id);
        first.GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("Ready");
        first.GetProperty("mechanicReady").GetBoolean().Should().BeFalse();
        first.GetProperty("findings").GetArrayLength().Should().Be(0);

        (await Submit(id, Finding("Brakes", "Required", 1000, 2000))).EnsureSuccessStatusCode();
        var second = await ReportOf(buyer, id);
        second.GetProperty("mechanicReady").GetBoolean().Should().BeTrue();
        second.GetProperty("bodyShop").GetProperty("findings").GetArrayLength().Should().Be(3, "the mechanic's submission leaves the shop's findings alone");
    }

    // L2-062: a shop-only review has no mechanic estimate, only the body shop's findings.
    [Fact]
    public async Task A_body_shop_only_review_has_only_the_body_shops_findings()
    {
        var (buyer, id) = await FinishedBodyShopOnlyCall();
        (await buyer.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await SubmitShop(id, ShopFindings)).EnsureSuccessStatusCode();
        (await Submit(id, Finding("Brakes", "Required", 1000, 2000))).StatusCode.Should().Be(HttpStatusCode.NotFound, "no mechanic is assigned");

        var report = await ReportOf(buyer, id);
        report.GetProperty("review").GetString().Should().Be("BodyShop");
        report.GetProperty("mechanicReady").GetBoolean().Should().BeFalse();
        report.GetProperty("mechanicName").ValueKind.Should().Be(JsonValueKind.Null);
        report.GetProperty("requiredCount").GetInt32().Should().Be(0);
        report.GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("Ready");
        (await buyer.GetAsync($"/api/inspections/{id}/report/pdf")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // L2-058: writing is by the assigned body shop only; a shop that is not assigned finds nothing.
    [Fact]
    public async Task Only_the_assigned_body_shop_writes_the_body_review()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = ShopFindings })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Mechanic.PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = ShopFindings })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BodyShop.PutAsJsonAsync($"/api/inspections/{id}/report", new { findings = ShopFindings })).StatusCode.Should().Be(HttpStatusCode.Forbidden, "the mechanic's estimate is the mechanic's to write");
        (await NewBuyer().PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = ShopFindings })).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Factory.ClientFor(null).PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = ShopFindings })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // A mechanic-only inspection has no body shop, so the seeded shop is not assigned to it.
        var (_, mechanicOnly) = await FinishedCall();
        (await SubmitShop(mechanicOnly, ShopFindings)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await BodyShop.GetAsync($"/api/calls/{mechanicOnly}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // L2-062 AC1: the assigned body shop is on the same call as the others.
    [Fact]
    public async Task The_assigned_body_shop_is_a_participant_of_the_call()
    {
        var (_, id) = await FinishedCall("Both");
        var call = await Json(await BodyShop.GetAsync($"/api/calls/{id}"));
        call.GetProperty("you").GetProperty("role").GetString().Should().Be("BodyShop");
        call.GetProperty("participants").EnumerateArray().Select(p => p.GetProperty("role").GetString()).Should()
            .Contain(new[] { "Buyer", "Mechanic", "BodyShop", "Seller" });
    }

    // The body review follows the same rules as the estimate: after the call, valid, and replaced when sent again.
    [Fact]
    public async Task The_body_review_is_validated_and_replaced_when_sent_again()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await BodyShop.PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = new[] { Finding("", "Required", 1, 2) } })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await BodyShop.PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings = Array.Empty<object>() })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await buyer.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.Conflict, "nothing was stored");

        (await SubmitShop(id, ShopFindings)).EnsureSuccessStatusCode();
        (await SubmitShop(id, Finding("Door ding", "Recommended", 10000, 15000))).EnsureSuccessStatusCode();
        var findings = (await ReportOf(buyer, id)).GetProperty("bodyShop").GetProperty("findings");
        findings.GetArrayLength().Should().Be(1);
        findings[0].GetProperty("title").GetString().Should().Be("Door ding");
    }

    // The body review follows the estimate's rule: it is written after the call, and the queue says where the call stands.
    [Fact]
    public async Task A_body_review_cannot_be_submitted_before_the_call_has_ended()
    {
        var (_, id) = await FinishedCall("Both", endCall: false);
        (await SubmitShop(id, ShopFindings)).StatusCode.Should().Be(HttpStatusCode.Conflict);
        var row = (await Json(await BodyShop.GetAsync("/api/reviews/assigned"))).EnumerateArray().Single(r => r.GetProperty("inspectionId").GetGuid() == id);
        row.GetProperty("callStatus").GetString().Should().Be("NotStarted");
        row.GetProperty("delivered").GetBoolean().Should().BeFalse();
    }

    // L2-058: the queue lists the shop's own inspections with where each stands, and nobody else's.
    [Fact]
    public async Task The_assigned_reviews_queue_lists_only_the_shops_own_inspections()
    {
        var (_, assigned) = await FinishedCall("Both");
        var (_, mechanicOnly) = await FinishedCall();
        var before = (await Json(await BodyShop.GetAsync("/api/reviews/assigned"))).EnumerateArray().ToArray();
        before.Select(r => r.GetProperty("inspectionId").GetGuid()).Should().Contain(assigned).And.NotContain(mechanicOnly);
        var row = before.Single(r => r.GetProperty("inspectionId").GetGuid() == assigned);
        row.GetProperty("callStatus").GetString().Should().Be("Ended");
        row.GetProperty("delivered").GetBoolean().Should().BeFalse();
        row.GetProperty("review").GetString().Should().Be("Both");
        row.GetProperty("vin").GetString().Should().NotBeNullOrEmpty();
        row.GetProperty("vehicleName").GetString().Should().Be("2016 Honda Civic"); // L2-085 AC5

        (await SubmitShop(assigned, ShopFindings)).EnsureSuccessStatusCode();
        var after = (await Json(await BodyShop.GetAsync("/api/reviews/assigned"))).EnumerateArray().Single(r => r.GetProperty("inspectionId").GetGuid() == assigned);
        after.GetProperty("delivered").GetBoolean().Should().BeTrue();

        (await Mechanic.GetAsync("/api/reviews/assigned")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await NewBuyer().GetAsync("/api/reviews/assigned")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Factory.ClientFor(null).GetAsync("/api/reviews/assigned")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // L2-047 with L2-062: a shared link carries the body review only when the buyer includes it.
    [Fact]
    public async Task A_shared_link_includes_the_body_review_only_when_the_buyer_does()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await Submit(id, Finding("Front brake pads", "Required", 30000, 45000))).EnsureSuccessStatusCode();
        (await SubmitShop(id, ShopFindings)).EnsureSuccessStatusCode();
        var anonymous = Factory.ClientFor(null);

        var with = (await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = true }))).GetProperty("token").GetString()!;
        var shared = await Json(await anonymous.GetAsync($"/api/shared-reports/{with}"));
        shared.GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("Ready");
        shared.GetProperty("bodyShop").GetProperty("findings").GetArrayLength().Should().Be(3);

        var without = (await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = false }))).GetProperty("token").GetString()!;
        without.Should().Be(with, "it is the same link");
        var narrowed = await Json(await anonymous.GetAsync($"/api/shared-reports/{without}"));
        narrowed.GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("NotShared");
        narrowed.GetProperty("bodyShop").GetProperty("findings").GetArrayLength().Should().Be(0);
    }
}

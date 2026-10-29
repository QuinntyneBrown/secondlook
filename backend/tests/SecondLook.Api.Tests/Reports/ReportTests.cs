using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using SecondLook.Api.Tests.Bookings;

namespace SecondLook.Api.Tests.Reports;

/// <summary>
/// The safety certification estimate report (ADR 0013): the mechanic submits findings and costs after the call, the buyer
/// reads the totals, and can share, download or question it. This fixture moves the clock to reach call time.
/// </summary>
/// <summary>Helpers shared by the report fixtures: a finished call, estimates and findings.</summary>
public abstract class ReportFlow(ApiFactory factory) : BookingFlow(factory)
{
    protected HttpClient BodyShop => Factory.ClientFor("BodyShop");

    /// <summary>Books an inspection, holds the call and ends it, as the buyer would.</summary>
    protected async Task<(HttpClient buyer, Guid id)> FinishedCall(string review = "Mechanic", bool endCall = true)
    {
        var buyer = NewBuyer();
        DateTimeOffset start;
        Guid id;
        if (review == "Both")
        {
            start = NextDay();
            await OpenWindow(2, start);
            (await BodyShop.PostAsJsonAsync("/api/availability", new { start, end = start.AddHours(2) })).StatusCode.Should().Be(HttpStatusCode.Created);
            var hold = await Json(await buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = MechanicId, start, bodyShopId = ApiFactory.SeededId("BodyShop") }));
            var vehicle = (await Json(await buyer.PostAsJsonAsync("/api/vehicles", new { year = 2016, make = "Honda", model = "Civic", vin = NewVin(), odometerKm = 100000, askingPrice = 7000, sellerName = "Sam Whitaker", sellerPhone = "9055550142" }))).GetProperty("id").GetGuid();
            var checkout = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = Guid.NewGuid().ToString(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
            var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Bo", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
            (await buyer.PostAsJsonAsync($"/api/checkouts/{checkout}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
            var confirmed = await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold.GetProperty("holdId").GetGuid(), bodyShopHoldId = hold.GetProperty("bodyShopHoldId").GetGuid(), vehicleId = vehicle });
            confirmed.StatusCode.Should().Be(HttpStatusCode.Created);
            id = (await Json(confirmed)).GetProperty("id").GetGuid();
        }
        else
        {
            start = await OpenWindow();
            id = await Book(buyer, start, review);
        }
        if (!endCall) return (buyer, id);
        Factory.Clock.Advance(start - Factory.Clock.GetUtcNow() - TimeSpan.FromMinutes(5));
        (await buyer.PostAsync($"/api/calls/{id}/join", null)).EnsureSuccessStatusCode();
        (await buyer.PostAsync($"/api/calls/{id}/end", null)).EnsureSuccessStatusCode();
        return (buyer, id);
    }

    protected static readonly Guid ShopId = ApiFactory.SeededId("BodyShop");

    protected Task<HttpResponseMessage> SubmitShop(Guid id, params object[] findings) =>
        BodyShop.PutAsJsonAsync($"/api/inspections/{id}/report/body-shop", new { findings });

    /// <summary>A body shop review booked with the shop alone (no mechanic), whose call has been held and ended.</summary>
    protected async Task<(HttpClient buyer, Guid id)> FinishedBodyShopOnlyCall()
    {
        var start = NextDay();
        (await BodyShop.PostAsJsonAsync("/api/availability", new { start, end = start.AddHours(2) })).StatusCode.Should().Be(HttpStatusCode.Created);
        var buyer = NewBuyer();
        var hold = (await Json(await buyer.PostAsJsonAsync("/api/bookings/holds", new { providerId = ShopId, start }))).GetProperty("holdId").GetGuid();
        var vehicle = (await Json(await buyer.PostAsJsonAsync("/api/vehicles", new { year = 2016, make = "Honda", model = "Civic", vin = NewVin(), odometerKm = 100000, askingPrice = 7000, sellerName = "Sam Whitaker", sellerPhone = "9055550142" }))).GetProperty("id").GetGuid();
        var checkout = (await Json(await buyer.PostAsJsonAsync("/api/checkouts", new { review = "BodyShop", idempotencyKey = Guid.NewGuid().ToString(), vehicleId = vehicle }))).GetProperty("id").GetGuid();
        var token = (await Json(await buyer.PostAsJsonAsync("/api/payments/tokens", new { cardNumber = Visa, expiry = "12 / 34", securityCode = "123", nameOnCard = "Bo", postalCode = "L8P 1A1" }))).GetProperty("token").GetString();
        (await buyer.PostAsJsonAsync($"/api/checkouts/{checkout}/pay", new { paymentToken = token })).StatusCode.Should().Be(HttpStatusCode.OK);
        var confirmed = await buyer.PostAsJsonAsync("/api/bookings", new { checkoutId = checkout, holdId = hold, vehicleId = vehicle });
        confirmed.StatusCode.Should().Be(HttpStatusCode.Created);
        var id = (await Json(confirmed)).GetProperty("id").GetGuid();
        Factory.Clock.Advance(start - Factory.Clock.GetUtcNow() - TimeSpan.FromMinutes(5));
        (await buyer.PostAsync($"/api/calls/{id}/join", null)).EnsureSuccessStatusCode();
        (await buyer.PostAsync($"/api/calls/{id}/end", null)).EnsureSuccessStatusCode();
        return (buyer, id);
    }

    /// <summary>Books another car for the same buyer at <paramref name="start"/>, holds its call and ends it.</summary>
    protected async Task<Guid> BookedCar(HttpClient buyer, DateTimeOffset start, bool endCall = true)
    {
        var id = await Book(buyer, start);
        if (!endCall) return id;
        var wait = start - TimeSpan.FromMinutes(5) - Factory.Clock.GetUtcNow();
        if (wait > TimeSpan.Zero) Factory.Clock.Advance(wait);
        (await buyer.PostAsync($"/api/calls/{id}/join", null)).EnsureSuccessStatusCode();
        (await buyer.PostAsync($"/api/calls/{id}/end", null)).EnsureSuccessStatusCode();
        return id;
    }

    protected async Task Estimated(Guid id, int min, int max) =>
        (await Submit(id, Finding("Brakes", "Required", min, max))).EnsureSuccessStatusCode();

    protected static object Finding(string title, string status, int? min = null, int? max = null, string note = "") =>
        new { title, note, status, minCents = min, maxCents = max };

    protected static object Estimate(params object[] findings) => new { findings };

    protected Task<HttpResponseMessage> Submit(Guid id, params object[] findings) =>
        Mechanic.PutAsJsonAsync($"/api/inspections/{id}/report", Estimate(findings));

    protected async Task<(HttpClient buyer, Guid id)> Submitted()
    {
        var (buyer, id) = await FinishedCall();
        (await Submit(id,
            Finding("Front brake pads", "Required", 30000, 45000, "Worn to 2 mm."),
            Finding("Rear tires", "Recommended", 40000, 60000, "Cracking on the sidewall."),
            Finding("Steering", "Passes"),
            Finding("Lower control arm bushing", "Required", 20000, 30000))).EnsureSuccessStatusCode();
        return (buyer, id);
    }
}

/// <summary>
/// The safety certification estimate report (ADR 0013): the mechanic submits findings and costs after the call, the buyer
/// reads the totals, and can share, download or question it. This fixture moves the clock to reach call time.
/// </summary>
public class ReportTests(ApiFactory factory) : ReportFlow(factory), IClassFixture<ApiFactory>
{
    // L2-050 AC1: the report cannot be written before the call has happened.
    [Fact]
    public async Task An_estimate_cannot_be_submitted_before_the_call_has_ended()
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        var response = await Submit(id, Finding("Brakes", "Required", 1000, 2000));
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-050 AC1, L2-045 AC1-3, AC5: the submitted estimate is the buyer's report, with totals.
    [Fact]
    public async Task A_submitted_estimate_becomes_the_buyers_report_with_totals()
    {
        var (buyer, id) = await Submitted();
        var response = await buyer.GetAsync($"/api/inspections/{id}/report");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var report = await Json(response);

        report.GetProperty("mechanicName").GetString().Should().Be("Maya Mechanic");
        report.GetProperty("requiredCount").GetInt32().Should().Be(2);
        report.GetProperty("costMinCents").GetInt32().Should().Be(50000);
        report.GetProperty("costMaxCents").GetInt32().Should().Be(75000);
        var asking = report.GetProperty("askingPriceCents").GetInt32();
        report.GetProperty("allInMinCents").GetInt32().Should().Be(asking + 50000);
        report.GetProperty("allInMaxCents").GetInt32().Should().Be(asking + 75000);
        report.GetProperty("callEndedAt").ValueKind.Should().Be(System.Text.Json.JsonValueKind.String);
        var findings = report.GetProperty("findings").EnumerateArray().ToArray();
        findings.Select(f => f.GetProperty("title").GetString()).Should().Equal("Front brake pads", "Rear tires", "Steering", "Lower control arm bushing");
        findings.Select(f => f.GetProperty("status").GetString()).Should().Equal("Required", "Recommended", "Passes", "Required");
        findings[2].GetProperty("minCents").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Null);
        report.GetProperty("disclaimer").GetString().Should().Contain("not a safety certificate");
    }

    // L2-046 AC2: a body shop that has not finished leaves the rest of the report readable.
    [Fact]
    public async Task A_body_shop_review_that_is_not_ready_is_in_progress_and_the_rest_still_shows()
    {
        var (buyer, id) = await FinishedCall("Both");
        (await Submit(id, Finding("Brakes", "Required", 10000, 20000))).EnsureSuccessStatusCode();
        var report = await Json(await buyer.GetAsync($"/api/inspections/{id}/report"));
        report.GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("InProgress");
        report.GetProperty("findings").GetArrayLength().Should().Be(1);

        var (buyer2, id2) = await Submitted();
        (await Json(await buyer2.GetAsync($"/api/inspections/{id2}/report"))).GetProperty("bodyShop").GetProperty("status").GetString().Should().Be("NotRequested");
    }

    // L2-046: before the mechanic submits there is nothing to read yet.
    [Fact]
    public async Task A_report_that_has_not_been_submitted_is_not_ready()
    {
        var (buyer, id) = await FinishedCall();
        var response = await buyer.GetAsync($"/api/inspections/{id}/report");
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-050: costs and findings are validated, and nothing is stored when they are not.
    [Fact]
    public async Task An_estimate_with_invalid_findings_is_refused()
    {
        var (buyer, id) = await FinishedCall();
        foreach (var bad in new[]
        {
            Estimate(),
            Estimate(Finding("", "Required", 1000, 2000)),
            Estimate(Finding("Brakes", "Urgent", 1000, 2000)),
            Estimate(Finding("Brakes", "Required", 5000, 2000)),
            Estimate(Finding("Brakes", "Required", -1, 2000)),
            Estimate(Finding("Brakes", "Required", 1000, null)),
            Estimate(Finding("Brakes", "Passes", 1000, 2000)),
            Estimate(Finding(new string('x', 201), "Required", 1000, 2000)),
        })
        {
            var response = await Mechanic.PutAsJsonAsync($"/api/inspections/{id}/report", bad);
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }
        (await buyer.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-050: submitting again replaces the findings instead of adding to them.
    [Fact]
    public async Task Submitting_again_replaces_the_findings()
    {
        var (buyer, id) = await Submitted();
        (await Submit(id, Finding("Exhaust leak", "Recommended", 15000, 25000))).EnsureSuccessStatusCode();
        var report = await Json(await buyer.GetAsync($"/api/inspections/{id}/report"));
        report.GetProperty("findings").GetArrayLength().Should().Be(1);
        report.GetProperty("requiredCount").GetInt32().Should().Be(0);
        report.GetProperty("costMinCents").GetInt32().Should().Be(0);
    }

    // L2-057, L2-058: only the assigned mechanic writes it; only the people on the inspection read it.
    [Fact]
    public async Task The_report_is_scoped_to_the_people_on_the_inspection()
    {
        var (buyer, id) = await Submitted();
        (await buyer.PutAsJsonAsync($"/api/inspections/{id}/report", Estimate(Finding("Brakes", "Required", 1, 2)))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await BodyShop.PutAsJsonAsync($"/api/inspections/{id}/report", Estimate(Finding("Brakes", "Required", 1, 2)))).StatusCode.Should().Be(HttpStatusCode.NotFound);

        var stranger = NewBuyer();
        (await stranger.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await stranger.GetAsync($"/api/inspections/{id}/report/pdf")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await BodyShop.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Mechanic.GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await Factory.ClientFor(null).GetAsync($"/api/inspections/{id}/report")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // L2-047 AC1, AC3: the buyer gets a link, emails it, and anyone with the link reads the report without an account.
    [Fact]
    public async Task A_shared_link_shows_the_report_without_an_account_and_without_buyer_details()
    {
        var (buyer, id) = await Submitted();
        var share = await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = true }));
        var token = share.GetProperty("token").GetString()!;
        share.GetProperty("expiresAt").GetDateTimeOffset().Should().BeCloseTo(Factory.Clock.GetUtcNow().AddDays(14), TimeSpan.FromMinutes(1));

        var again = await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = true }));
        again.GetProperty("token").GetString().Should().Be(token, "asking again returns the same active link");

        var sent = await buyer.PostAsJsonAsync($"/api/inspections/{id}/report/share/email", new { email = "sam.whitaker@example.com" });
        sent.StatusCode.Should().Be(HttpStatusCode.OK);
        Factory.Mailbox.LastTokenFor("sam.whitaker@example.com", "share-report").Should().Be(token);

        var anonymous = Factory.ClientFor(null);
        var response = await anonymous.GetAsync($"/api/shared-reports/{token}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var report = await Json(response);
        report.GetProperty("findings").GetArrayLength().Should().Be(4);
        var text = await response.Content.ReadAsStringAsync();
        text.Should().NotContain("sellerPhone").And.NotContain("sellerName").And.NotContain("buyer");
        (await anonymous.GetAsync("/api/shared-reports/not-a-real-token")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // L2-047 AC2, AC4: a bad address is refused with the field message.
    [Fact]
    public async Task Sharing_by_email_validates_the_address()
    {
        var (buyer, id) = await Submitted();
        await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = true });
        var response = await buyer.PostAsJsonAsync($"/api/inspections/{id}/report/share/email", new { email = "sam.whitaker@example" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await response.Content.ReadAsStringAsync()).Should().Contain("Enter a valid email address, like name@example.com.");
    }

    // L2-047 AC5: turning the link off ends access, and a stranger cannot manage the link.
    [Fact]
    public async Task Turning_the_link_off_ends_access_and_only_the_buyer_can_do_it()
    {
        var (buyer, id) = await Submitted();
        var token = (await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = false }))).GetProperty("token").GetString()!;
        var anonymous = Factory.ClientFor(null);
        (await anonymous.GetAsync($"/api/shared-reports/{token}")).StatusCode.Should().Be(HttpStatusCode.OK);

        (await NewBuyer().DeleteAsync($"/api/inspections/{id}/report/share")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Mechanic.DeleteAsync($"/api/inspections/{id}/report/share")).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        (await buyer.DeleteAsync($"/api/inspections/{id}/report/share")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await buyer.DeleteAsync($"/api/inspections/{id}/report/share")).StatusCode.Should().Be(HttpStatusCode.NoContent, "turning it off twice is harmless");
        var gone = await anonymous.GetAsync($"/api/shared-reports/{token}");
        gone.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await gone.Content.ReadAsStringAsync()).Should().Contain("This report isn’t shared with you");

        var fresh = await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = false }));
        fresh.GetProperty("token").GetString().Should().NotBe(token, "a new link is a new token");
    }

    // L2-048 AC1: the buyer downloads a PDF copy.
    [Fact]
    public async Task The_report_downloads_as_a_pdf()
    {
        var (buyer, id) = await Submitted();
        var response = await buyer.GetAsync($"/api/inspections/{id}/report/pdf");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/pdf");
        response.Content.Headers.ContentDisposition!.FileName.Should().Contain(".pdf");
        var bytes = await response.Content.ReadAsByteArrayAsync();
        Encoding.ASCII.GetString(bytes, 0, 5).Should().Be("%PDF-");
        Encoding.ASCII.GetString(bytes).Should().Contain("Front brake pads");
    }

    // L2-049 AC1-AC3: the buyer can ask the mechanic to look again, with a reason.
    [Fact]
    public async Task The_buyer_can_report_an_issue_with_a_reason()
    {
        var (buyer, id) = await Submitted();
        var empty = await buyer.PostAsJsonAsync($"/api/inspections/{id}/report/issues", new { reason = "", details = "" });
        empty.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await empty.Content.ReadAsStringAsync()).Should().Contain("Choose what’s wrong.");

        var sent = await buyer.PostAsJsonAsync($"/api/inspections/{id}/report/issues", new { reason = "CostSeemsOff", details = "The brake price looks high." });
        sent.StatusCode.Should().Be(HttpStatusCode.Created);
        (await NewBuyer().PostAsJsonAsync($"/api/inspections/{id}/report/issues", new { reason = "SomethingElse" })).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}

/// <summary>Link expiry moves the clock two weeks, so it has its own host.</summary>
public class ReportExpiryTests(ApiFactory factory) : ReportFlow(factory), IClassFixture<ApiFactory>
{
    // L2-047: a link stops working after 14 days.
    [Fact]
    public async Task A_shared_link_expires_after_fourteen_days()
    {
        var (buyer, id) = await Submitted();
        var token = (await Json(await buyer.PutAsJsonAsync($"/api/inspections/{id}/report/share", new { includeBodyShop = false }))).GetProperty("token").GetString()!;
        Factory.Clock.Advance(TimeSpan.FromDays(14) + TimeSpan.FromMinutes(1));
        (await Factory.ClientFor(null).GetAsync($"/api/shared-reports/{token}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Application.Payments;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Payments;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Payments;

public class PaymentTests : IClassFixture<ApiFactory>
{
    private const string Visa = "4242 4242 4242 4242";
    private const string Declined = "4000 0000 0000 0002";
    private const string NeedsApproval = "4000 0025 0000 3155";

    private readonly ApiFactory _factory;
    public PaymentTests(ApiFactory factory) => _factory = factory;

    private HttpClient Buyer(Guid? id = null) => _factory.ClientFor("Buyer", id);

    /// <summary>A brand-new buyer so pricing windows never leak between tests.</summary>
    private HttpClient NewBuyer(out Guid id)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        id = Guid.NewGuid();
        db.Users.Add(new User { Id = id, Email = $"pay{id:N}@example.test", DisplayName = "Pat Payer", Role = UserRole.Buyer, EmailVerified = true });
        db.SaveChanges();
        return _factory.ClientFor("Buyer", id);
    }

    private static object Card(string number = Visa, string expiry = "12 / 34", string cvc = "123") =>
        new { cardNumber = number, expiry, securityCode = cvc, nameOnCard = "Jordan Lee", postalCode = "L8P 1A1" };

    private async Task<string> Tokenize(HttpClient client, string number = Visa)
    {
        var response = await client.PostAsJsonAsync("/api/payments/tokens", Card(number));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
    }

    private static async Task<JsonElement> Json(HttpResponseMessage r) => await r.Content.ReadFromJsonAsync<JsonElement>();

    private async Task<JsonElement> CreateCheckout(HttpClient client, string review = "Mechanic", string? key = null)
    {
        var response = await client.PostAsJsonAsync("/api/checkouts", new { review, idempotencyKey = key ?? Guid.NewGuid().ToString() });
        response.StatusCode.Should().BeOneOf(HttpStatusCode.Created, HttpStatusCode.OK);
        return await Json(response);
    }

    private static int Total(JsonElement checkout) => checkout.GetProperty("quote").GetProperty("totalCents").GetInt32();

    private async Task<HttpResponseMessage> Pay(HttpClient client, Guid checkoutId, string token) =>
        await client.PostAsJsonAsync($"/api/checkouts/{checkoutId}/pay", new { paymentToken = token });

    // L2-027 AC1, AC3: the server prices the first review at $50 and both reviews at $70.
    [Fact]
    public async Task The_first_inspection_costs_fifty_and_both_reviews_add_twenty()
    {
        var buyer = NewBuyer(out _);
        Total(await CreateCheckout(buyer, "Mechanic")).Should().Be(5000);
        var both = await CreateCheckout(buyer, "Both");
        Total(both).Should().Be(7000);
        both.GetProperty("quote").GetProperty("lines").EnumerateArray().Select(l => l.GetProperty("label").GetString())
            .Should().Equal("Mechanic review", "Body shop review add-on");
    }

    // L2-027 AC2, AC4, AC5: after the first payment the window is open ($25), until it closes after 14 days.
    [Fact]
    public async Task Additional_vehicles_in_the_window_cost_twenty_five_until_it_closes()
    {
        var buyer = NewBuyer(out _);
        var first = await CreateCheckout(buyer);
        var pending = await CreateCheckout(buyer, "Both"); // priced before the window exists
        Total(pending).Should().Be(7000);
        (await Pay(buyer, first.GetProperty("id").GetGuid(), await Tokenize(buyer))).StatusCode.Should().Be(HttpStatusCode.OK);

        var refreshed = await Json(await buyer.GetAsync($"/api/checkouts/{pending.GetProperty("id").GetGuid()}"));
        Total(refreshed).Should().Be(4500); // additional vehicle $25 + $20 both reviews
        refreshed.GetProperty("quote").GetProperty("lines")[0].GetProperty("label").GetString().Should().Be("Additional vehicle");

        _factory.Clock.Advance(TimeSpan.FromDays(15));
        Total(await Json(await buyer.GetAsync($"/api/checkouts/{pending.GetProperty("id").GetGuid()}"))).Should().Be(7000);
    }

    // L2-029: creating the same checkout twice returns the existing one.
    [Fact]
    public async Task Creating_a_checkout_is_idempotent_per_key()
    {
        var buyer = NewBuyer(out _);
        var first = await CreateCheckout(buyer, key: "same-key");
        var second = await CreateCheckout(buyer, key: "same-key");
        second.GetProperty("id").GetGuid().Should().Be(first.GetProperty("id").GetGuid());
        (await CreateCheckout(buyer, key: "other-key")).GetProperty("id").GetGuid().Should().NotBe(first.GetProperty("id").GetGuid());
    }

    // L2-028 AC2: card details are validated with the specified messages.
    [Fact]
    public async Task Card_details_are_validated()
    {
        var response = await Buyer().PostAsJsonAsync("/api/payments/tokens", new { cardNumber = "4000 0566 5566", expiry = "13 / 28", securityCode = "", nameOnCard = "", postalCode = "" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await Json(response)).GetProperty("errors");
        errors.GetProperty("cardNumber")[0].GetString().Should().Be("Enter the 16 digits on the front of your card.");
        errors.GetProperty("expiry")[0].GetString().Should().Be("That expiry date isn’t valid.");
        errors.GetProperty("securityCode")[0].GetString().Should().Be("Enter the 3-digit security code.");
        errors.TryGetProperty("nameOnCard", out _).Should().BeTrue();
        errors.TryGetProperty("postalCode", out _).Should().BeTrue();
    }

    // L2-028, L2-029 AC2: payment succeeds, returns a receipt, and card details are never stored.
    [Fact]
    public async Task Paying_succeeds_and_stores_only_the_brand_and_last_four()
    {
        var buyer = NewBuyer(out _);
        var checkout = await CreateCheckout(buyer);
        var id = checkout.GetProperty("id").GetGuid();
        var response = await Pay(buyer, id, await Tokenize(buyer));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var paid = await Json(response);
        paid.GetProperty("status").GetString().Should().Be("Paid");
        paid.GetProperty("amountCents").GetInt32().Should().Be(5000);
        paid.GetProperty("cardLast4").GetString().Should().Be("4242");
        (await Json(await buyer.GetAsync($"/api/checkouts/{id}"))).GetProperty("status").GetString().Should().Be("Paid");

        using var scope = _factory.Services.CreateScope();
        var payment = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Payments.SingleAsync(p => p.CheckoutId == id);
        payment.AmountCents.Should().Be(5000);
        JsonSerializer.Serialize(payment).Should().NotContain("4242424242424242");
    }

    // L2-028 AC4: a decline is a 402, nothing is charged and the checkout stays pending so another card can be tried.
    [Fact]
    public async Task A_declined_card_is_not_charged_and_can_be_retried()
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer, "Both")).GetProperty("id").GetGuid();
        var declined = await Pay(buyer, id, await Tokenize(buyer, Declined));
        declined.StatusCode.Should().Be(HttpStatusCode.PaymentRequired);
        var problem = await Json(declined);
        problem.GetProperty("title").GetString().Should().Be("Your card was declined");
        problem.GetProperty("detail").GetString().Should().Be("Your bank didn’t approve $70.00. Try another card, or call the number on the back of this one. You haven’t been charged.");
        (await Json(await buyer.GetAsync($"/api/checkouts/{id}"))).GetProperty("status").GetString().Should().Be("Pending");
        (await Pay(buyer, id, await Tokenize(buyer))).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // L2-028 AC5: a bank that wants approval returns 202 and nothing is charged yet.
    [Fact]
    public async Task A_card_that_needs_bank_approval_is_accepted_but_not_paid()
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        var response = await Pay(buyer, id, await Tokenize(buyer, NeedsApproval));
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        var body = await Json(response);
        body.GetProperty("status").GetString().Should().Be("RequiresAction");
        body.GetProperty("message").GetString().Should().Be("Your bank may ask you to approve $50.00 in its app.");
        (await Json(await buyer.GetAsync($"/api/checkouts/{id}"))).GetProperty("status").GetString().Should().Be("Pending");
    }

    // L2-029 AC2: paying twice returns the same payment and charges once.
    [Fact]
    public async Task Paying_twice_returns_the_existing_payment_without_charging_again()
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        var token = await Tokenize(buyer);
        var first = await Json(await Pay(buyer, id, token));
        var second = await Pay(buyer, id, await Tokenize(buyer));
        second.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(second)).GetProperty("paymentId").GetGuid().Should().Be(first.GetProperty("paymentId").GetGuid());
        _factory.Services.GetRequiredService<LocalPaymentProcessor>().ChargesFor(id).Should().Be(1);
    }

    [Fact]
    public async Task Concurrent_payments_charge_exactly_once()
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        var tokens = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Tokenize(buyer)));
        var responses = await Task.WhenAll(tokens.Select(t => Pay(buyer, id, t)));
        responses.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        (await Task.WhenAll(responses.Select(Json))).Select(j => j.GetProperty("paymentId").GetGuid()).Distinct().Should().HaveCount(1);
        _factory.Services.GetRequiredService<LocalPaymentProcessor>().ChargesFor(id).Should().Be(1);
    }

    // L2-057: another buyer's checkout is not found.
    [Fact]
    public async Task A_checkout_belongs_to_one_buyer()
    {
        var owner = NewBuyer(out _);
        var id = (await CreateCheckout(owner)).GetProperty("id").GetGuid();
        var other = NewBuyer(out _);
        (await other.GetAsync($"/api/checkouts/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Pay(other, id, await Tokenize(other))).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("Mechanic")]
    [InlineData("BodyShop")]
    [InlineData("Admin")]
    public async Task Only_buyers_pay(string role)
    {
        (await _factory.ClientFor(role).PostAsJsonAsync("/api/checkouts", new { review = "Mechanic", idempotencyKey = "x" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(role).GetAsync("/api/billing/receipts")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task An_invalid_review_choice_is_a_validation_problem()
    {
        (await Buyer().PostAsJsonAsync("/api/checkouts", new { review = "Nothing", idempotencyKey = "k" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Buyer().PostAsJsonAsync("/api/checkouts", new { review = "Mechanic", idempotencyKey = "" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // L2-031: billing history lists receipts newest first with what was bought.
    [Fact]
    public async Task Billing_history_lists_paid_receipts()
    {
        var buyer = NewBuyer(out _);
        (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts").GetArrayLength().Should().Be(0);
        var first = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        await Pay(buyer, first, await Tokenize(buyer));
        var second = (await CreateCheckout(buyer, "Both")).GetProperty("id").GetGuid();
        await Pay(buyer, second, await Tokenize(buyer));

        var receipts = (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts").EnumerateArray().ToArray();
        receipts.Should().HaveCount(2);
        receipts[0].GetProperty("for").GetString().Should().Be("additional vehicle + body shop");
        receipts[0].GetProperty("amountCents").GetInt32().Should().Be(4500);
        receipts[0].GetProperty("status").GetString().Should().Be("Paid");
        receipts[1].GetProperty("for").GetString().Should().Be("first inspection");
        receipts[1].GetProperty("amountCents").GetInt32().Should().Be(5000);
    }

    // L2-032: refund rules.
    [Theory]
    [InlineData(RefundReason.SellerNoShow, null, 5000)]
    [InlineData(RefundReason.InspectionIncomplete, null, 5000)]
    [InlineData(RefundReason.BuyerCancelled, 3, 5000)]
    [InlineData(RefundReason.BuyerCancelled, 1, 2500)]
    public async Task Refunds_follow_the_rules(RefundReason reason, int? hoursBeforeCall, int refundedCents)
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        var paymentId = (await Json(await Pay(buyer, id, await Tokenize(buyer)))).GetProperty("paymentId").GetGuid();
        var result = await Mediate(new RefundPaymentCommand(paymentId, reason, hoursBeforeCall, false));
        result.Should().BeOfType<RefundResult.Refunded>().Which.AmountCents.Should().Be(refundedCents);
        var receipt = (await Json(await buyer.GetAsync("/api/billing/receipts"))).GetProperty("receipts")[0];
        receipt.GetProperty("status").GetString().Should().Be(refundedCents == 5000 ? "Refunded" : "Partially refunded");
        (await Mediate(new RefundPaymentCommand(paymentId, reason, hoursBeforeCall, false))).Should().BeOfType<RefundResult.AlreadyRefunded>();
    }

    // L2-032 AC5: a delivered report is not refundable.
    [Fact]
    public async Task A_delivered_report_is_not_refundable()
    {
        var buyer = NewBuyer(out _);
        var id = (await CreateCheckout(buyer)).GetProperty("id").GetGuid();
        var paymentId = (await Json(await Pay(buyer, id, await Tokenize(buyer)))).GetProperty("paymentId").GetGuid();
        (await Mediate(new RefundPaymentCommand(paymentId, RefundReason.BuyerRequested, null, true))).Should().BeOfType<RefundResult.NotRefundable>();
    }

    private async Task<RefundResult> Mediate(RefundPaymentCommand command)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(command);
    }
}

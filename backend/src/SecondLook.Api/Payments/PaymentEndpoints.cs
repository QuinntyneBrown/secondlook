using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Payments;

namespace SecondLook.Api.Payments;

public sealed record CardTokenRequest(string? CardNumber, string? Expiry, string? SecurityCode, string? NameOnCard, string? PostalCode);
public sealed record CheckoutRequest(string? Review, string? IdempotencyKey, Guid? VehicleId);
public sealed record PayRequest(string? PaymentToken);

public static class PaymentEndpoints
{
    public static IEndpointRouteBuilder MapPaymentEndpoints(this IEndpointRouteBuilder app)
    {
        // The buyer comes from the token. Prices are never accepted from the client (ADR 0007).
        var group = app.MapGroup("/api").RequireAuthorization(Policies.Buyer);

        // The processor's hosted-fields step: card details go here, never to the pay endpoint, and are not stored.
        group.MapPost("/payments/tokens", async (CardTokenRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new TokenizeCardCommand(new CardDetails(r.CardNumber, r.Expiry, r.SecurityCode, r.NameOnCard, r.PostalCode)), ct) switch
            {
                TokenizeResult.Ok ok => Results.Ok(new { token = ok.Token.Token, brand = ok.Token.Brand, last4 = ok.Token.Last4 }),
                TokenizeResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
                _ => Results.StatusCode(500),
            });

        group.MapPost("/checkouts", async (CheckoutRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new CreateCheckoutCommand(r.Review, r.IdempotencyKey, r.VehicleId), ct) switch
            {
                CheckoutResult.Saved { Created: true } s => Results.Created($"/api/checkouts/{s.Checkout.Id}", s.Checkout),
                CheckoutResult.Saved s => Results.Ok(s.Checkout),
                CheckoutResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
                _ => Results.StatusCode(500),
            });

        group.MapGet("/checkouts/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new GetCheckoutQuery(id), ct) is { } c ? Results.Ok(c) : Results.NotFound());

        group.MapPost("/checkouts/{id:guid}/pay", async (Guid id, PayRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new PayCheckoutCommand(id, r.PaymentToken), ct) switch
            {
                PayResult.Paid p => Results.Ok(new { status = "Paid", paymentId = p.Payment.PaymentId, checkoutId = p.Payment.CheckoutId, amountCents = p.Payment.AmountCents, cardBrand = p.Payment.CardBrand, cardLast4 = p.Payment.CardLast4, paidAt = p.Payment.PaidAt }),
                PayResult.Declined d => Results.Problem($"Your bank didn’t approve {Money.Format(d.AmountCents)}. Try another card, or call the number on the back of this one. You haven’t been charged.", statusCode: 402, title: "Your card was declined"),
                PayResult.RequiresAction a => Results.Json(new { status = "RequiresAction", message = $"Your bank may ask you to approve {Money.Format(a.AmountCents)} in its app." }, statusCode: 202),
                PayResult.NotFound => Results.NotFound(),
                _ => Results.Problem("Add your card details again to get a new payment token.", statusCode: 400, title: "We couldn’t use that payment method"),
            });

        group.MapGet("/billing/receipts", async (IMediator m, CancellationToken ct) =>
            Results.Ok(new { receipts = await m.Send(new ListReceiptsQuery(), ct) }));
        return app;
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Payments;

namespace SecondLook.Application.Payments;

public sealed record CardDetails(string? CardNumber, string? Expiry, string? SecurityCode, string? NameOnCard, string? PostalCode);

public sealed record CardToken(string Token, string Brand, string Last4);

public abstract record ChargeResult
{
    public sealed record Succeeded(string Reference, string Brand, string Last4) : ChargeResult;
    public sealed record Declined : ChargeResult;
    public sealed record RequiresAction : ChargeResult;
    public sealed record UnknownToken : ChargeResult;
}

/// <summary>The payment processor. The local adapter stands in for a real one; no card number ever leaves it.</summary>
public interface IPaymentProcessor
{
    /// <summary>Exchanges validated card details for an opaque token (the processor's hosted-fields step).</summary>
    CardToken Tokenize(CardDetails card);

    /// <summary>Charges once per <paramref name="reference"/>: a repeat with the same reference returns the first result.</summary>
    ChargeResult Charge(string token, int amountCents, string reference);

    void Refund(string reference, int amountCents);
}

public static class Money
{
    public static string Format(int cents) => $"${cents / 100m:0.00}";
}

internal static class CardRules
{
    public static IReadOnlyDictionary<string, string[]>? Validate(CardDetails c, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string[]>();
        var digits = new string((c.CardNumber ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length != 16) errors["cardNumber"] = ["Enter the 16 digits on the front of your card."];

        var expiry = new string((c.Expiry ?? "").Where(char.IsDigit).ToArray());
        var validExpiry = false;
        if (expiry.Length == 4 && int.TryParse(expiry[..2], out var month) && int.TryParse(expiry[2..], out var yy) && month is >= 1 and <= 12)
        {
            var end = new DateTime(2000 + yy, month, 1).AddMonths(1);
            validExpiry = end > now.UtcDateTime;
        }
        if (!validExpiry) errors["expiry"] = ["That expiry date isn’t valid."];

        if (!(c.SecurityCode is { Length: 3 } cvc && cvc.All(char.IsDigit))) errors["securityCode"] = ["Enter the 3-digit security code."];
        if (string.IsNullOrWhiteSpace(c.NameOnCard)) errors["nameOnCard"] = ["Enter the name on the card."];
        if (string.IsNullOrWhiteSpace(c.PostalCode)) errors["postalCode"] = ["Enter your postal code."];
        return errors.Count == 0 ? null : errors;
    }
}

public abstract record TokenizeResult
{
    public sealed record Ok(CardToken Token) : TokenizeResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : TokenizeResult;
}

public sealed record TokenizeCardCommand(CardDetails Card) : IRequest<TokenizeResult>;

public sealed class TokenizeCardHandler(IPaymentProcessor processor, TimeProvider clock) : IRequestHandler<TokenizeCardCommand, TokenizeResult>
{
    public Task<TokenizeResult> Handle(TokenizeCardCommand c, CancellationToken ct) =>
        Task.FromResult<TokenizeResult>(CardRules.Validate(c.Card, clock.GetUtcNow()) is { } errors
            ? new TokenizeResult.Invalid(errors)
            : new TokenizeResult.Ok(processor.Tokenize(c.Card)));
}

public sealed record QuoteLineDto(string Label, int Cents);
public sealed record QuoteDto(IReadOnlyList<QuoteLineDto> Lines, int TotalCents);
public sealed record CheckoutDto(Guid Id, string Review, string Status, QuoteDto Quote, DateTimeOffset CreatedAt);

/// <summary>Prices a buyer's purchase from the authoritative rules.</summary>
public sealed class PricingService(IAppDbContext db, TimeProvider clock)
{
    public async Task<bool> WindowOpenAsync(Guid buyerId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return (await db.PricingWindows.Where(w => w.BuyerId == buyerId).ToListAsync(ct)).Any(w => w.IsOpen(now));
    }

    public async Task<PriceQuote> QuoteAsync(Guid buyerId, ReviewType review, CancellationToken ct) =>
        PriceCalculator.Quote(review, await WindowOpenAsync(buyerId, ct));

    public static QuoteDto ToDto(PriceQuote q) => new(q.Lines.Select(l => new QuoteLineDto(l.Label, l.Cents)).ToList(), q.TotalCents);
}

public abstract record CheckoutResult
{
    public sealed record Saved(CheckoutDto Checkout, bool Created) : CheckoutResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : CheckoutResult;
}

public sealed record CreateCheckoutCommand(string? Review, string? IdempotencyKey, Guid? VehicleId) : IRequest<CheckoutResult>;

public sealed class CreateCheckoutHandler(IAppDbContext db, ICurrentUser caller, PricingService pricing, TimeProvider clock) : IRequestHandler<CreateCheckoutCommand, CheckoutResult>
{
    public async Task<CheckoutResult> Handle(CreateCheckoutCommand c, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (!Enum.TryParse<ReviewType>(c.Review, out var review) || !Enum.IsDefined(review)) errors["review"] = ["Choose a mechanic review, a body shop review or both."];
        if (string.IsNullOrWhiteSpace(c.IdempotencyKey) || c.IdempotencyKey.Length > 100) errors["idempotencyKey"] = ["Send an idempotency key of up to 100 characters."];
        if (errors.Count > 0) return new CheckoutResult.Invalid(errors);

        var key = c.IdempotencyKey!.Trim();
        var existing = await db.Checkouts.ForBuyer(caller).FirstOrDefaultAsync(x => x.IdempotencyKey == key, ct);
        if (existing is not null) return new CheckoutResult.Saved(await CheckoutMapper.ToDtoAsync(existing, pricing, db, ct), false);

        var checkout = new Checkout { Id = Guid.NewGuid(), BuyerId = caller.Id, Review = review, VehicleId = c.VehicleId, IdempotencyKey = key, CreatedAt = clock.GetUtcNow() };
        db.Checkouts.Add(checkout);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            var winner = await db.Checkouts.ForBuyer(caller).FirstAsync(x => x.IdempotencyKey == key, ct);
            return new CheckoutResult.Saved(await CheckoutMapper.ToDtoAsync(winner, pricing, db, ct), false);
        }
        return new CheckoutResult.Saved(await CheckoutMapper.ToDtoAsync(checkout, pricing, db, ct), true);
    }
}

internal static class CheckoutMapper
{
    /// <summary>Pending checkouts show today's price; paid ones show what was charged.</summary>
    public static async Task<CheckoutDto> ToDtoAsync(Checkout c, PricingService pricing, IAppDbContext db, CancellationToken ct)
    {
        QuoteDto quote;
        if (c.Status == CheckoutStatus.Paid)
        {
            var payment = await db.Payments.FirstAsync(p => p.CheckoutId == c.Id, ct);
            quote = new QuoteDto([new QuoteLineDto(payment.Description, payment.AmountCents)], payment.AmountCents);
        }
        else quote = PricingService.ToDto(await pricing.QuoteAsync(c.BuyerId, c.Review, ct));
        return new CheckoutDto(c.Id, c.Review.ToString(), c.Status.ToString(), quote, c.CreatedAt);
    }
}

public sealed record GetCheckoutQuery(Guid Id) : IRequest<CheckoutDto?>;

public sealed class GetCheckoutHandler(IAppDbContext db, ICurrentUser caller, PricingService pricing) : IRequestHandler<GetCheckoutQuery, CheckoutDto?>
{
    public async Task<CheckoutDto?> Handle(GetCheckoutQuery q, CancellationToken ct)
    {
        var c = await db.Checkouts.ForBuyer(caller).FirstOrDefaultAsync(x => x.Id == q.Id, ct);
        return c is null ? null : await CheckoutMapper.ToDtoAsync(c, pricing, db, ct);
    }
}

public sealed record PaymentDto(Guid PaymentId, Guid CheckoutId, int AmountCents, string CardBrand, string CardLast4, DateTimeOffset PaidAt);

public abstract record PayResult
{
    public sealed record Paid(PaymentDto Payment) : PayResult;
    public sealed record Declined(int AmountCents) : PayResult;
    public sealed record RequiresAction(int AmountCents) : PayResult;
    public sealed record NotFound : PayResult;
    public sealed record BadToken : PayResult;
}

public sealed record PayCheckoutCommand(Guid CheckoutId, string? PaymentToken) : IRequest<PayResult>;

public sealed class PayCheckoutHandler(IAppDbContext db, ICurrentUser caller, PricingService pricing, IPaymentProcessor processor, TimeProvider clock) : IRequestHandler<PayCheckoutCommand, PayResult>
{
    public async Task<PayResult> Handle(PayCheckoutCommand c, CancellationToken ct)
    {
        var checkout = await db.Checkouts.ForBuyer(caller).FirstOrDefaultAsync(x => x.Id == c.CheckoutId, ct);
        if (checkout is null) return new PayResult.NotFound();

        // Already paid: return the existing payment and never charge again (L2-029).
        var existing = await db.Payments.FirstOrDefaultAsync(p => p.CheckoutId == checkout.Id, ct);
        if (existing is not null) return new PayResult.Paid(ToDto(existing));
        if (string.IsNullOrWhiteSpace(c.PaymentToken)) return new PayResult.BadToken();

        var windowOpen = await pricing.WindowOpenAsync(caller.Id, ct);
        var quote = PriceCalculator.Quote(checkout.Review, windowOpen);

        // The processor charges once per checkout, so concurrent requests cannot double charge.
        switch (processor.Charge(c.PaymentToken, quote.TotalCents, checkout.Id.ToString()))
        {
            case ChargeResult.UnknownToken: return new PayResult.BadToken();
            case ChargeResult.Declined: return new PayResult.Declined(quote.TotalCents);
            case ChargeResult.RequiresAction: return new PayResult.RequiresAction(quote.TotalCents);
            case ChargeResult.Succeeded ok:
                var now = clock.GetUtcNow();
                var payment = new Payment
                {
                    Id = Guid.NewGuid(), CheckoutId = checkout.Id, BuyerId = caller.Id, AmountCents = quote.TotalCents,
                    Description = PriceCalculator.Describe(checkout.Review, windowOpen), CardBrand = ok.Brand, CardLast4 = ok.Last4,
                    ProcessorReference = ok.Reference, PaidAt = now,
                };
                db.Payments.Add(payment);
                checkout.Status = CheckoutStatus.Paid;
                if (!windowOpen) db.PricingWindows.Add(new PricingWindow { Id = Guid.NewGuid(), BuyerId = caller.Id, StartsAt = now, EndsAt = now + PriceCalculator.WindowLength });
                try
                {
                    await db.SaveChangesAsync(ct);
                }
                catch (DbUpdateException)
                {
                    db.ChangeTracker.Clear();
                    return new PayResult.Paid(ToDto(await db.Payments.FirstAsync(p => p.CheckoutId == c.CheckoutId, ct)));
                }
                return new PayResult.Paid(ToDto(payment));
        }
        return new PayResult.BadToken();
    }

    private static PaymentDto ToDto(Payment p) => new(p.Id, p.CheckoutId, p.AmountCents, p.CardBrand, p.CardLast4, p.PaidAt);
}

public sealed record ReceiptDto(Guid PaymentId, DateTimeOffset Date, string For, int AmountCents, string Status);

public sealed record ListReceiptsQuery : IRequest<IReadOnlyList<ReceiptDto>>;

public sealed class ListReceiptsHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<ListReceiptsQuery, IReadOnlyList<ReceiptDto>>
{
    public async Task<IReadOnlyList<ReceiptDto>> Handle(ListReceiptsQuery q, CancellationToken ct)
    {
        var rows = await db.Payments.ForBuyer(caller).ToListAsync(ct);
        return rows.OrderByDescending(p => p.PaidAt).Select(p => new ReceiptDto(p.Id, p.PaidAt, p.Description, p.AmountCents, p.Status)).ToList();
    }
}

public enum RefundReason
{
    SellerNoShow = 1,
    InspectionIncomplete = 2,
    BuyerCancelled = 3,
    BuyerRequested = 4,
}

public abstract record RefundResult
{
    public sealed record Refunded(int AmountCents, int RetainedCents) : RefundResult;
    public sealed record AlreadyRefunded : RefundResult;
    public sealed record NotRefundable : RefundResult;
    public sealed record NotFound : RefundResult;
}

/// <summary>The refund contract of L2-032, used by the booking journeys; there is no buyer-facing endpoint in J05.</summary>
public sealed record RefundPaymentCommand(Guid PaymentId, RefundReason Reason, int? HoursBeforeCall, bool ReportDelivered) : IRequest<RefundResult>;

public sealed class RefundPaymentHandler(IAppDbContext db, IPaymentProcessor processor, TimeProvider clock) : IRequestHandler<RefundPaymentCommand, RefundResult>
{
    public const int RetainedCents = 2500;

    public async Task<RefundResult> Handle(RefundPaymentCommand c, CancellationToken ct)
    {
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == c.PaymentId, ct);
        if (payment is null) return new RefundResult.NotFound();
        if (c.ReportDelivered) return new RefundResult.NotRefundable();
        if (payment.RefundedCents > 0) return new RefundResult.AlreadyRefunded();

        var lateCancel = c.Reason is RefundReason.BuyerCancelled or RefundReason.BuyerRequested && c.HoursBeforeCall is < 2;
        var retained = lateCancel ? Math.Min(RetainedCents, payment.AmountCents) : 0;
        var refund = payment.AmountCents - retained;

        processor.Refund(payment.ProcessorReference, refund);
        payment.RefundedCents = refund;
        payment.RefundedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return new RefundResult.Refunded(refund, retained);
    }
}

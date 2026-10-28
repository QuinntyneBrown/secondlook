using System.Collections.Concurrent;
using System.Security.Cryptography;
using SecondLook.Application.Payments;

namespace SecondLook.Infrastructure.Payments;

/// <summary>
/// Local stand-in for a payment processor (ADR 0007). Card numbers are looked at only to pick a behaviour
/// and to keep the last four digits; they are never stored. Nothing is ever charged.
/// Test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined, 4000 0025 0000 3155 needs bank approval.
/// </summary>
public sealed class LocalPaymentProcessor : IPaymentProcessor
{
    private sealed record Card(string Brand, string Last4, string Behaviour);

    private readonly ConcurrentDictionary<string, Card> _tokens = new();
    private readonly ConcurrentDictionary<string, ChargeResult> _charges = new();
    private readonly ConcurrentDictionary<string, int> _chargeCounts = new();
    private readonly object _gate = new();

    public CardToken Tokenize(CardDetails card)
    {
        var digits = new string((card.CardNumber ?? "").Where(char.IsDigit).ToArray());
        var behaviour = digits switch { "4000000000000002" => "decline", "4000002500003155" => "action", _ => "ok" };
        var brand = digits.StartsWith('4') ? "Visa" : digits.StartsWith('5') ? "Mastercard" : "Card";
        var token = "tok_local_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        _tokens[token] = new Card(brand, digits[^4..], behaviour);
        return new CardToken(token, brand, digits[^4..]);
    }

    public ChargeResult Charge(string token, int amountCents, string reference)
    {
        if (!_tokens.TryGetValue(token, out var card)) return new ChargeResult.UnknownToken();
        lock (_gate)
        {
            if (_charges.TryGetValue(reference, out var earlier)) return earlier;
            ChargeResult result = card.Behaviour switch
            {
                "decline" => new ChargeResult.Declined(),
                "action" => new ChargeResult.RequiresAction(),
                _ => new ChargeResult.Succeeded("ch_local_" + reference[..8], card.Brand, card.Last4),
            };
            // Only a success is remembered: a declined card can be retried with another one.
            if (result is ChargeResult.Succeeded)
            {
                _charges[reference] = result;
                _chargeCounts.AddOrUpdate(reference, 1, (_, n) => n + 1);
            }
            return result;
        }
    }

    public void Refund(string reference, int amountCents)
    {
        // Nothing to call; a real adapter would ask the processor to refund the charge.
    }

    /// <summary>How many times the checkout was really charged (for tests and demos).</summary>
    public int ChargesFor(Guid checkoutId) => _chargeCounts.GetValueOrDefault(checkoutId.ToString());
}

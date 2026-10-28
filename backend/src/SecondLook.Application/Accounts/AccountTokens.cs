using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Accounts;

/// <summary>Sends link emails. The local adapter is <see cref="LocalMailbox"/>; no real mail leaves the machine.</summary>
public interface IEmailSender
{
    Task SendLinkAsync(string to, string purpose, string token, CancellationToken ct);
}

/// <summary>In-memory mail adapter for local, test and demo hosts.</summary>
public sealed class LocalMailbox : IEmailSender
{
    private readonly List<(string To, string Purpose, string Token)> _sent = [];

    public Task SendLinkAsync(string to, string purpose, string token, CancellationToken ct)
    {
        lock (_sent) _sent.Add((to, purpose, token));
        return Task.CompletedTask;
    }

    public string LastTokenFor(string email, string purpose)
    {
        lock (_sent) return _sent.Last(m => m.To == email.ToLowerInvariant() && m.Purpose == purpose).Token;
    }
}

public interface IAccessTokenIssuer
{
    string Issue(User user);
}

/// <summary>Issues, emails and redeems single-use link tokens.</summary>
public sealed class AccountTokens(IAppDbContext db, IEmailSender mail, TimeProvider clock)
{
    public const string VerifyEmail = "verify-email";
    public const string ResetPassword = "reset-password";

    public static TimeSpan Lifetime(string purpose) => purpose == VerifyEmail ? TimeSpan.FromHours(24) : TimeSpan.FromMinutes(30);

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public async Task SendAsync(User user, string purpose, CancellationToken ct)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        db.AccountTokens.Add(new AccountToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Purpose = purpose,
            TokenHash = Hash(token),
            ExpiresAt = clock.GetUtcNow().Add(Lifetime(purpose)),
        });
        await db.SaveChangesAsync(ct);
        await mail.SendLinkAsync(user.Email, purpose, token, ct);
    }

    public enum Outcome { Ok, Invalid, Expired }

    /// <summary>Marks a token used when it is valid; returns the owner. The caller saves changes.</summary>
    public async Task<(Outcome Outcome, User? User)> RedeemAsync(string? token, string purpose, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token)) return (Outcome.Invalid, null);
        var hash = Hash(token);
        var row = await db.AccountTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.Purpose == purpose && t.UsedAt == null, ct);
        if (row is null) return (Outcome.Invalid, null);
        if (row.ExpiresAt <= clock.GetUtcNow()) return (Outcome.Expired, null);
        row.UsedAt = clock.GetUtcNow();
        var user = await db.Users.SingleAsync(u => u.Id == row.UserId, ct);
        return (Outcome.Ok, user);
    }
}

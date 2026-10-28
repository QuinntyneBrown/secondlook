using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;

namespace SecondLook.Application.Accounts;

public sealed record ForgotPasswordCommand(string? Email) : IRequest<IReadOnlyDictionary<string, string[]>?>;

/// <summary>Returns field errors for an invalid email; otherwise null, whether or not an account exists.</summary>
public sealed class ForgotPasswordHandler(IAppDbContext db, AccountTokens tokens)
    : IRequestHandler<ForgotPasswordCommand, IReadOnlyDictionary<string, string[]>?>
{
    public async Task<IReadOnlyDictionary<string, string[]>?> Handle(ForgotPasswordCommand c, CancellationToken ct)
    {
        if (!RegisterHandler.IsValidEmail(c.Email))
            return new Dictionary<string, string[]> { ["email"] = ["Enter a valid email address."] };
        var email = c.Email!.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user is not null) await tokens.SendAsync(user, AccountTokens.ResetPassword, ct);
        return null;
    }
}

public sealed record ResetPasswordCommand(string? Token, string? NewPassword, string? ConfirmPassword) : IRequest<ResetResult>;

public abstract record ResetResult
{
    public sealed record Done(string Token) : ResetResult;
    public sealed record InvalidLink : ResetResult;
    public sealed record Expired : ResetResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : ResetResult;
}

public sealed class ResetPasswordHandler(IAppDbContext db, AccountTokens tokens, IPasswordHasher hasher, IAccessTokenIssuer issuer)
    : IRequestHandler<ResetPasswordCommand, ResetResult>
{
    public async Task<ResetResult> Handle(ResetPasswordCommand c, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (c.NewPassword is null || c.NewPassword.Length < 10) errors["newPassword"] = ["Use at least 10 characters."];
        if (c.NewPassword != c.ConfirmPassword) errors["confirmPassword"] = ["The passwords don’t match."];
        if (errors.Count > 0) return new ResetResult.Invalid(errors);

        var (outcome, user) = await tokens.RedeemAsync(c.Token, AccountTokens.ResetPassword, ct);
        if (user is null) return outcome == AccountTokens.Outcome.Expired ? new ResetResult.Expired() : new ResetResult.InvalidLink();

        user.PasswordHash = hasher.Hash(c.NewPassword!);
        user.EmailVerified = true; // holding the emailed link proves the address
        await db.SaveChangesAsync(ct);
        return new ResetResult.Done(issuer.Issue(user));
    }
}

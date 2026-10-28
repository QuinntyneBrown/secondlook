using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Accounts;

public sealed record VerifyEmailCommand(string? Token) : IRequest<AccountTokens.Outcome>;

public sealed class VerifyEmailHandler(IAppDbContext db, AccountTokens tokens) : IRequestHandler<VerifyEmailCommand, AccountTokens.Outcome>
{
    public async Task<AccountTokens.Outcome> Handle(VerifyEmailCommand c, CancellationToken ct)
    {
        var (outcome, user) = await tokens.RedeemAsync(c.Token, AccountTokens.VerifyEmail, ct);
        if (user is not null)
        {
            user.EmailVerified = true;
            await db.SaveChangesAsync(ct);
        }
        return outcome;
    }
}

/// <summary>Always succeeds from the caller's view so it never reveals whether an account exists.</summary>
public sealed record ResendVerificationCommand(string? Email) : IRequest;

public sealed class ResendVerificationHandler(IAppDbContext db, AccountTokens tokens) : IRequestHandler<ResendVerificationCommand>
{
    public async Task Handle(ResendVerificationCommand c, CancellationToken ct)
    {
        var email = c.Email?.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && !u.EmailVerified, ct);
        if (user is not null) await tokens.SendAsync(user, AccountTokens.VerifyEmail, ct);
    }
}

public sealed record LoginCommand(string? Email, string? Password) : IRequest<LoginResult>;

public abstract record LoginResult
{
    public sealed record SignedIn(string Token, UserRole Role, bool IsApproved, string DisplayName) : LoginResult;
    public sealed record BadCredentials : LoginResult;
    public sealed record EmailNotVerified : LoginResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : LoginResult;
}

public sealed class LoginHandler(IAppDbContext db, IPasswordHasher hasher, IAccessTokenIssuer issuer) : IRequestHandler<LoginCommand, LoginResult>
{
    public async Task<LoginResult> Handle(LoginCommand c, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (!RegisterHandler.IsValidEmail(c.Email)) errors["email"] = ["Enter a valid email address."];
        if (string.IsNullOrEmpty(c.Password)) errors["password"] = ["Enter your password."];
        if (errors.Count > 0) return new LoginResult.Invalid(errors);

        var email = c.Email!.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.IsActive, ct);
        if (user?.PasswordHash is null || !hasher.Verify(user.PasswordHash, c.Password!)) return new LoginResult.BadCredentials();
        if (!user.EmailVerified) return new LoginResult.EmailNotVerified();
        return new LoginResult.SignedIn(issuer.Issue(user), user.Role, user.IsApproved, user.DisplayName);
    }
}

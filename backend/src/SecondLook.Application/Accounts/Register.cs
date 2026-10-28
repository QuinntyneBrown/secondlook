using System.Net.Mail;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Accounts;

public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public sealed record RegisterCommand(string? FullName, string? Email, string? Password, bool AcceptedTerms, string? Role)
    : IRequest<RegisterResult>;

public abstract record RegisterResult
{
    public sealed record Created(Guid UserId, string Email) : RegisterResult;
    public sealed record Conflict : RegisterResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : RegisterResult;
}

public sealed class RegisterHandler(IAppDbContext db, IPasswordHasher hasher, AccountTokens tokens) : IRequestHandler<RegisterCommand, RegisterResult>
{
    public static bool IsValidEmail(string? email) =>
        !string.IsNullOrWhiteSpace(email) && MailAddress.TryCreate(email, out var a) && a.Address == email && email.Contains('.', StringComparison.Ordinal) && !email.EndsWith('.');

    public async Task<RegisterResult> Handle(RegisterCommand c, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(c.FullName)) errors["fullName"] = ["Enter your name."];
        if (!IsValidEmail(c.Email)) errors["email"] = ["Enter a valid email address."];
        if (c.Password is null || c.Password.Length < 10) errors["password"] = ["Use at least 10 characters."];
        if (!c.AcceptedTerms) errors["acceptedTerms"] = ["Agree to the Terms and Privacy policy to continue."];
        var role = c.Role is null ? UserRole.Buyer : Enum.TryParse<UserRole>(c.Role, out var r) ? r : (UserRole?)null;
        if (role is null or UserRole.Admin) errors["role"] = ["Choose buyer, mechanic or body shop."];
        if (errors.Count > 0) return new RegisterResult.Invalid(errors);

        var email = c.Email!.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct)) return new RegisterResult.Conflict();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = c.FullName!.Trim(),
            Role = role!.Value,
            PasswordHash = hasher.Hash(c.Password!),
            ApprovalStatus = role == UserRole.Buyer ? ApprovalStatus.Approved : ApprovalStatus.Pending,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        await tokens.SendAsync(user, AccountTokens.VerifyEmail, ct);
        return new RegisterResult.Created(user.Id, email);
    }
}

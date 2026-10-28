using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Domain.Users;

namespace SecondLook.Application.Accounts;

public sealed record ProviderDto(Guid Id, string Kind, string DisplayName, string Email, string? LicenceNumber, string? Location, string ApprovalStatus, bool CanTakeInspections)
{
    public static ProviderDto From(User u) =>
        new(u.Id, u.Role.ToString(), u.DisplayName, u.Email, u.LicenceNumber, u.Location, u.ApprovalStatus.ToString(), u.CanTakeInspections);
}

public sealed record ListProvidersQuery(string? Status, string? Kind) : IRequest<IReadOnlyList<ProviderDto>>;

public sealed class ListProvidersHandler(IAppDbContext db) : IRequestHandler<ListProvidersQuery, IReadOnlyList<ProviderDto>>
{
    public async Task<IReadOnlyList<ProviderDto>> Handle(ListProvidersQuery q, CancellationToken ct)
    {
        var query = db.Users.Where(u => u.Role == UserRole.Mechanic || u.Role == UserRole.BodyShop);
        if (Enum.TryParse<ApprovalStatus>(q.Status, out var status)) query = query.Where(u => u.ApprovalStatus == status);
        if (Enum.TryParse<UserRole>(q.Kind, out var kind)) query = query.Where(u => u.Role == kind);
        var rows = await query.OrderBy(u => u.DisplayName).ToListAsync(ct);
        return rows.Select(ProviderDto.From).ToList();
    }
}

public sealed record GetProviderQuery(Guid Id) : IRequest<ProviderDto?>;

public sealed class GetProviderHandler(IAppDbContext db) : IRequestHandler<GetProviderQuery, ProviderDto?>
{
    public async Task<ProviderDto?> Handle(GetProviderQuery q, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == q.Id && (u.Role == UserRole.Mechanic || u.Role == UserRole.BodyShop), ct);
        return user is null ? null : ProviderDto.From(user);
    }
}

public sealed record OnboardProviderCommand(string? Kind, string? DisplayName, string? Email, string? LicenceNumber, string? Location) : IRequest<OnboardResult>;

public abstract record OnboardResult
{
    public sealed record Created(ProviderDto Provider) : OnboardResult;
    public sealed record Existing(ProviderDto Provider) : OnboardResult;
    public sealed record Conflict : OnboardResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : OnboardResult;
}

/// <summary>Creates a pending provider without a password and emails a set-your-password link (ADR 0004).</summary>
public sealed class OnboardProviderHandler(IAppDbContext db, AccountTokens tokens) : IRequestHandler<OnboardProviderCommand, OnboardResult>
{
    public async Task<OnboardResult> Handle(OnboardProviderCommand c, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var kind = Enum.TryParse<UserRole>(c.Kind, out var k) && k is UserRole.Mechanic or UserRole.BodyShop ? k : (UserRole?)null;
        if (kind is null) errors["kind"] = ["Choose mechanic or body shop."];
        if (string.IsNullOrWhiteSpace(c.DisplayName)) errors["displayName"] = ["Enter the provider’s name."];
        if (!RegisterHandler.IsValidEmail(c.Email)) errors["email"] = ["Enter a valid email address."];
        if (string.IsNullOrWhiteSpace(c.LicenceNumber)) errors["licenceNumber"] = ["Enter the licence number."];
        if (string.IsNullOrWhiteSpace(c.Location)) errors["location"] = ["Enter the location."];
        if (errors.Count > 0) return new OnboardResult.Invalid(errors);

        var email = c.Email!.Trim().ToLowerInvariant();
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (existing is not null)
            return existing.Role == kind ? new OnboardResult.Existing(ProviderDto.From(existing)) : new OnboardResult.Conflict();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = c.DisplayName!.Trim(),
            Role = kind!.Value,
            ApprovalStatus = ApprovalStatus.Pending,
            LicenceNumber = c.LicenceNumber!.Trim(),
            Location = c.Location!.Trim(),
            EmailVerified = true, // the administrator vouches for the address; the link proves control of it
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        await tokens.SendAsync(user, AccountTokens.ResetPassword, ct);
        return new OnboardResult.Created(ProviderDto.From(user));
    }
}

public enum TransitionOutcome { Done, NotFound, Conflict }

public sealed record ApproveProviderCommand(Guid Id) : IRequest<TransitionOutcome>;
public sealed record DeactivateProviderCommand(Guid Id) : IRequest<TransitionOutcome>;

public sealed class ApproveProviderHandler(IAppDbContext db) : IRequestHandler<ApproveProviderCommand, TransitionOutcome>
{
    public async Task<TransitionOutcome> Handle(ApproveProviderCommand c, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == c.Id && (u.Role == UserRole.Mechanic || u.Role == UserRole.BodyShop), ct);
        if (user is null) return TransitionOutcome.NotFound;
        if (!user.Approve()) return TransitionOutcome.Conflict;
        await db.SaveChangesAsync(ct);
        return TransitionOutcome.Done;
    }
}

public sealed class DeactivateProviderHandler(IAppDbContext db) : IRequestHandler<DeactivateProviderCommand, TransitionOutcome>
{
    public async Task<TransitionOutcome> Handle(DeactivateProviderCommand c, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == c.Id && (u.Role == UserRole.Mechanic || u.Role == UserRole.BodyShop), ct);
        if (user is null) return TransitionOutcome.NotFound;
        if (!user.Deactivate()) return TransitionOutcome.Conflict;
        await db.SaveChangesAsync(ct);
        return TransitionOutcome.Done;
    }
}

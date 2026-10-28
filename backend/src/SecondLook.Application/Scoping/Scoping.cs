using SecondLook.Domain.Users;

namespace SecondLook.Application.Scoping;

/// <summary>The authenticated caller. Handlers read this, never a client-supplied user id.</summary>
public interface ICurrentUser
{
    Guid Id { get; }
    UserRole Role { get; }
}

public sealed record CurrentUser(Guid Id, UserRole Role) : ICurrentUser;

/// <summary>A resource a buyer owns (vehicles, inspections, estimates).</summary>
public interface IBuyerOwned
{
    Guid BuyerId { get; }
}

/// <summary>An inspection assigned to a mechanic and/or body shop.</summary>
public interface IProviderAssigned
{
    Guid? MechanicId { get; }
    Guid? BodyShopId { get; }
}

public static class ScopingExtensions
{
    /// <summary>Only the caller's own resources; another buyer's resource is absent, never forbidden (L2-057).</summary>
    public static IQueryable<T> ForBuyer<T>(this IQueryable<T> query, ICurrentUser caller) where T : IBuyerOwned =>
        query.Where(x => x.BuyerId == caller.Id);

    /// <summary>
    /// Buyers see what they own, mechanics and body shops what is assigned to them (L2-058),
    /// administrators everything; any other caller sees nothing.
    /// </summary>
    public static IQueryable<T> ForCaller<T>(this IQueryable<T> query, ICurrentUser caller) where T : IBuyerOwned, IProviderAssigned
    {
        var id = caller.Id;
        return caller.Role switch
        {
            UserRole.Buyer => query.Where(x => x.BuyerId == id),
            UserRole.Mechanic => query.Where(x => x.MechanicId == id),
            UserRole.BodyShop => query.Where(x => x.BodyShopId == id),
            UserRole.Admin => query,
            _ => query.Where(_ => false),
        };
    }
}

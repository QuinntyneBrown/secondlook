namespace SecondLook.Domain.Scoping;

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

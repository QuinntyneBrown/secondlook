namespace SecondLook.Domain.Vehicles;

/// <summary>How a car is named on screen (ADR 0018): "2016 Honda Civic", or its VIN for rows saved before the make was recorded.</summary>
public static class VehicleName
{
    public static string Of(int year, string make, string model, string? vin) =>
        string.IsNullOrEmpty(make) ? vin ?? "" : $"{year} {make} {model}";
}

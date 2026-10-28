using System.Text.RegularExpressions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SecondLook.Application.Abstractions;
using SecondLook.Application.Scoping;
using SecondLook.Domain.Vehicles;

namespace SecondLook.Application.Vehicles;

public sealed record VehicleDto(Guid Id, string Vin, int OdometerKm, decimal AskingPrice, string? ListingUrl, string SellerName, string SellerPhone)
{
    public static VehicleDto From(Vehicle v) => new(v.Id, v.Vin, v.OdometerKm, v.AskingPrice, v.ListingUrl, v.SellerName, v.SellerPhone);
}

/// <summary>The editable fields of a saved vehicle, as submitted.</summary>
public sealed record VehicleInput(string? Vin, int? OdometerKm, decimal? AskingPrice, string? ListingUrl, string? SellerName, string? SellerPhone);

internal sealed record CleanVehicle(string Vin, int OdometerKm, decimal AskingPrice, string? ListingUrl, string SellerName, string SellerPhone);

internal static partial class VehicleRules
{
    [GeneratedRegex("^[A-HJ-NPR-Z0-9]{17}$")]
    private static partial Regex VinPattern();

    public static (CleanVehicle? Clean, IReadOnlyDictionary<string, string[]>? Errors) Validate(VehicleInput i)
    {
        var errors = new Dictionary<string, string[]>();
        var vin = (i.Vin ?? "").Trim().ToUpperInvariant();
        if (vin.Length != 17) errors["vin"] = ["Enter the full 17-character VIN."];
        else if (!VinPattern().IsMatch(vin)) errors["vin"] = ["A VIN uses letters and digits, but never I, O or Q."];

        if (i.OdometerKm is null or < 0 or > 1_500_000) errors["odometerKm"] = ["Enter the odometer reading in kilometres, up to 1,500,000."];
        if (i.AskingPrice is null or < 0 or > 1_000_000) errors["askingPrice"] = ["Enter the asking price in dollars, up to 1,000,000."];

        string? url = string.IsNullOrWhiteSpace(i.ListingUrl) ? null : i.ListingUrl.Trim();
        if (url is not null && !(Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https"))
            errors["listingUrl"] = ["Enter a link that starts with http:// or https://."];

        var name = (i.SellerName ?? "").Trim();
        if (name.Length is 0 or > 100) errors["sellerName"] = ["Enter the seller’s name, up to 100 characters."];

        var digits = new string((i.SellerPhone ?? "").Where(char.IsDigit).ToArray());
        if (digits.Length == 11 && digits[0] == '1') digits = digits[1..];
        if (digits.Length != 10) errors["sellerPhone"] = ["Enter the seller’s 10-digit phone number."];

        return errors.Count > 0
            ? (null, errors)
            : (new CleanVehicle(vin, i.OdometerKm!.Value, decimal.Round(i.AskingPrice!.Value, 2), url, name, digits), null);
    }
}

public abstract record VehicleResult
{
    public sealed record Saved(VehicleDto Vehicle, bool Created) : VehicleResult;
    public sealed record Removed : VehicleResult;
    public sealed record Invalid(IReadOnlyDictionary<string, string[]> Errors) : VehicleResult;
    public sealed record Duplicate : VehicleResult;
    public sealed record NotFound : VehicleResult;
}

public sealed record ListVehiclesQuery : IRequest<IReadOnlyList<VehicleDto>>;

public sealed class ListVehiclesHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<ListVehiclesQuery, IReadOnlyList<VehicleDto>>
{
    public async Task<IReadOnlyList<VehicleDto>> Handle(ListVehiclesQuery q, CancellationToken ct)
    {
        var rows = await db.Vehicles.ForBuyer(caller).Where(v => v.RemovedAt == null).ToListAsync(ct);
        return rows.OrderBy(v => v.SellerName).ThenBy(v => v.Vin).Select(VehicleDto.From).ToList();
    }
}

public sealed record GetVehicleQuery(Guid Id) : IRequest<VehicleDto?>;

public sealed class GetVehicleHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<GetVehicleQuery, VehicleDto?>
{
    public async Task<VehicleDto?> Handle(GetVehicleQuery q, CancellationToken ct)
    {
        var v = await db.Vehicles.ForBuyer(caller).FirstOrDefaultAsync(x => x.Id == q.Id && x.RemovedAt == null, ct);
        return v is null ? null : VehicleDto.From(v);
    }
}

public sealed record AddVehicleCommand(VehicleInput Input) : IRequest<VehicleResult>;

public sealed class AddVehicleHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<AddVehicleCommand, VehicleResult>
{
    public async Task<VehicleResult> Handle(AddVehicleCommand c, CancellationToken ct)
    {
        var (clean, errors) = VehicleRules.Validate(c.Input);
        if (clean is null) return new VehicleResult.Invalid(errors!);
        if (await db.Vehicles.ForBuyer(caller).AnyAsync(v => v.Vin == clean.Vin && v.RemovedAt == null, ct)) return new VehicleResult.Duplicate();

        var vehicle = new Vehicle
        {
            Id = Guid.NewGuid(), BuyerId = caller.Id, Vin = clean.Vin, OdometerKm = clean.OdometerKm, AskingPrice = clean.AskingPrice,
            ListingUrl = clean.ListingUrl, SellerName = clean.SellerName, SellerPhone = clean.SellerPhone,
        };
        db.Vehicles.Add(vehicle);
        await db.SaveChangesAsync(ct);
        return new VehicleResult.Saved(VehicleDto.From(vehicle), true);
    }
}

public sealed record UpdateVehicleCommand(Guid Id, VehicleInput Input) : IRequest<VehicleResult>;

public sealed class UpdateVehicleHandler(IAppDbContext db, ICurrentUser caller) : IRequestHandler<UpdateVehicleCommand, VehicleResult>
{
    public async Task<VehicleResult> Handle(UpdateVehicleCommand c, CancellationToken ct)
    {
        var vehicle = await db.Vehicles.ForBuyer(caller).FirstOrDefaultAsync(v => v.Id == c.Id && v.RemovedAt == null, ct);
        if (vehicle is null) return new VehicleResult.NotFound();
        var (clean, errors) = VehicleRules.Validate(c.Input);
        if (clean is null) return new VehicleResult.Invalid(errors!);
        if (await db.Vehicles.ForBuyer(caller).AnyAsync(v => v.Id != vehicle.Id && v.Vin == clean.Vin && v.RemovedAt == null, ct)) return new VehicleResult.Duplicate();

        vehicle.Vin = clean.Vin;
        vehicle.OdometerKm = clean.OdometerKm;
        vehicle.AskingPrice = clean.AskingPrice;
        vehicle.ListingUrl = clean.ListingUrl;
        vehicle.SellerName = clean.SellerName;
        vehicle.SellerPhone = clean.SellerPhone;
        await db.SaveChangesAsync(ct);
        return new VehicleResult.Saved(VehicleDto.From(vehicle), false);
    }
}

public sealed record RemoveVehicleCommand(Guid Id) : IRequest<VehicleResult>;

public sealed class RemoveVehicleHandler(IAppDbContext db, ICurrentUser caller, TimeProvider clock) : IRequestHandler<RemoveVehicleCommand, VehicleResult>
{
    public async Task<VehicleResult> Handle(RemoveVehicleCommand c, CancellationToken ct)
    {
        var vehicle = await db.Vehicles.ForBuyer(caller).FirstOrDefaultAsync(v => v.Id == c.Id && v.RemovedAt == null, ct);
        if (vehicle is null) return new VehicleResult.NotFound();
        vehicle.RemovedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(ct);
        return new VehicleResult.Removed();
    }
}

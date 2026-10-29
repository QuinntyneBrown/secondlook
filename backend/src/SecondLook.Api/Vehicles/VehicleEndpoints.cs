using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Vehicles;

namespace SecondLook.Api.Vehicles;

public sealed record VehicleRequest(int? Year, string? Make, string? Model, string? Vin, int? OdometerKm, decimal? AskingPrice, string? ListingUrl, string? SellerName, string? SellerPhone)
{
    public VehicleInput ToInput() => new(Year, Make, Model, Vin, OdometerKm, AskingPrice, ListingUrl, SellerName, SellerPhone);
}

public static class VehicleEndpoints
{
    public static IEndpointRouteBuilder MapVehicleEndpoints(this IEndpointRouteBuilder app)
    {
        // The buyer comes from the token; no buyer id is accepted from the request, so one buyer can never address another's data.
        var group = app.MapGroup("/api/vehicles").RequireAuthorization(Policies.Buyer);

        group.MapGet("", async (IMediator m, CancellationToken ct) => Results.Ok(await m.Send(new ListVehiclesQuery(), ct)));

        group.MapGet("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new GetVehicleQuery(id), ct) is { } v ? Results.Ok(v) : Results.NotFound());

        group.MapPost("", async (VehicleRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new AddVehicleCommand(r.ToInput()), ct)));

        group.MapPut("/{id:guid}", async (Guid id, VehicleRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new UpdateVehicleCommand(id, r.ToInput()), ct)));

        group.MapDelete("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new RemoveVehicleCommand(id), ct)));
        return app;
    }

    private static IResult Respond(VehicleResult result) => result switch
    {
        VehicleResult.Saved { Created: true } s => Results.Created($"/api/vehicles/{s.Vehicle.Id}", s.Vehicle),
        VehicleResult.Saved s => Results.Ok(s.Vehicle),
        VehicleResult.Removed => Results.NoContent(),
        VehicleResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
        VehicleResult.Duplicate => Results.Problem("Edit the saved one instead, or remove it first.", statusCode: 409, title: "You already saved that vehicle"),
        _ => Results.NotFound(),
    };
}

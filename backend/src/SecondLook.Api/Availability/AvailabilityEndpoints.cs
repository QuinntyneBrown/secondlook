using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Availability;

namespace SecondLook.Api.Availability;

public sealed record WindowRequest(DateTimeOffset Start, DateTimeOffset End);

public static class AvailabilityEndpoints
{
    public static IEndpointRouteBuilder MapAvailabilityEndpoints(this IEndpointRouteBuilder app)
    {
        // The caller is always the provider: no provider id is accepted from the request (ADR 0005).
        var mine = app.MapGroup("/api/availability").RequireAuthorization(Policies.Provider);

        mine.MapGet("", async (IMediator m, CancellationToken ct) => Results.Ok(await m.Send(new GetAvailabilityQuery(), ct)));

        mine.MapPost("", async (WindowRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new AddWindowCommand(r.Start, r.End), ct)));

        mine.MapPut("/{id:guid}", async (Guid id, WindowRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new UpdateWindowCommand(id, r.Start, r.End), ct)));

        mine.MapDelete("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new RemoveWindowCommand(id), ct)));

        app.MapGet("/api/slots", async (DateTimeOffset? from, DateTimeOffset? to, string? kind, IMediator m, CancellationToken ct) =>
                Results.Ok(await m.Send(new ListSlotsQuery(from, to, kind), ct)))
            .RequireAuthorization(Policies.Buyer);
        return app;
    }

    private static IResult Respond(WindowResult result) => result switch
    {
        WindowResult.Saved { Created: true } s => Results.Created($"/api/availability/{s.Window.Id}", s.Window),
        WindowResult.Saved s => Results.Ok(s.Window),
        WindowResult.Removed => Results.NoContent(),
        WindowResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
        WindowResult.Overlap => Results.Problem("That time overlaps a window you already saved.", statusCode: 409, title: "That overlaps another window"),
        WindowResult.Booked => Results.Problem("A booking falls inside this time. Handle the booking first.", statusCode: 409, title: "That time is already booked"),
        WindowResult.NotApproved => Results.Problem("Only approved providers can set availability.", statusCode: 403, title: "Your account isn’t approved yet"),
        _ => Results.NotFound(),
    };
}

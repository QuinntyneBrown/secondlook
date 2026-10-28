using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Bookings;

namespace SecondLook.Api.Bookings;

public sealed record HoldRequest(Guid ProviderId, DateTimeOffset Start);
public sealed record ConfirmRequest(Guid CheckoutId, Guid HoldId, Guid VehicleId);

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder app)
    {
        var buyer = app.MapGroup("/api/bookings").RequireAuthorization(Policies.Buyer);

        buyer.MapPost("/holds", async (HoldRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new HoldSlotCommand(r.ProviderId, r.Start), ct) switch
            {
                HoldResult.Held h => Results.Created($"/api/bookings/holds/{h.Hold.HoldId}", h.Hold),
                _ => SlotTaken(),
            });

        buyer.MapPost("", async (ConfirmRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new ConfirmBookingCommand(r.CheckoutId, r.HoldId, r.VehicleId), ct) switch
            {
                ConfirmResult.Created c => Results.Created($"/api/inspections/{c.Inspection.Id}", c.Inspection),
                ConfirmResult.Existing e => Results.Ok(e.Inspection),
                ConfirmResult.PaymentRequired => Results.Problem("Pay for this inspection first.", statusCode: 402, title: "Payment required"),
                ConfirmResult.SlotLost l => Results.Problem(l.Refunded ? "Someone just took it. You haven’t been charged: your payment was refunded in full. Pick another time." : "Someone just took it. Pick another time.", statusCode: 409, title: "We couldn’t hold that slot"),
                _ => Results.NotFound(),
            });

        // Buyers see their own inspections, mechanics and body shops only those assigned to them (L2-057, L2-058).
        var inspections = app.MapGroup("/api/inspections").RequireAuthorization(Policies.Inspections);
        inspections.MapGet("", async (IMediator m, CancellationToken ct) => Results.Ok(new { inspections = await m.Send(new ListInspectionsQuery(), ct) }));
        inspections.MapGet("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new GetInspectionQuery(id), ct) is { } i ? Results.Ok(i) : Results.NotFound());
        return app;
    }

    private static IResult SlotTaken() =>
        Results.Problem("Someone just took it. Pick another time and you won’t lose your answers.", statusCode: 409, title: "We couldn’t hold that slot");
}

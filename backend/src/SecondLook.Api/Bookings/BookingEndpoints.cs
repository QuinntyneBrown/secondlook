using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Bookings;

namespace SecondLook.Api.Bookings;

public sealed record HoldRequest(Guid ProviderId, DateTimeOffset Start, Guid? BodyShopId = null);
public sealed record ConfirmRequest(Guid CheckoutId, Guid HoldId, Guid VehicleId, Guid? BodyShopHoldId = null);
public sealed record RescheduleRequest(DateTimeOffset Start);
public sealed record CancelRequest(string? Reason);

public static class BookingEndpoints
{
    public static IEndpointRouteBuilder MapBookingEndpoints(this IEndpointRouteBuilder app)
    {
        var buyer = app.MapGroup("/api/bookings").RequireAuthorization(Policies.Buyer);

        buyer.MapPost("/holds", async (HoldRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new HoldSlotCommand(r.ProviderId, r.Start, r.BodyShopId), ct) switch
            {
                HoldResult.Held h => Results.Created($"/api/bookings/holds/{h.Hold.HoldId}", h.Hold),
                _ => SlotTaken(),
            });

        buyer.MapPost("", async (ConfirmRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new ConfirmBookingCommand(r.CheckoutId, r.HoldId, r.VehicleId, r.BodyShopHoldId), ct) switch
            {
                ConfirmResult.Created c => Results.Created($"/api/inspections/{c.Inspection.Id}", c.Inspection),
                ConfirmResult.Existing e => Results.Ok(e.Inspection),
                ConfirmResult.PaymentRequired => Results.Problem("Pay for this inspection first.", statusCode: 402, title: "Payment required"),
                ConfirmResult.SlotLost l => Results.Problem(l.Refunded ? "Someone just took it. You haven’t been charged: your payment was refunded in full. Pick another time." : "Someone just took it. Pick another time.", statusCode: 409, title: "We couldn’t hold that slot"),
                ConfirmResult.HoldMismatch => Results.Problem("The times you held don’t match the review you paid for. Pick your time again.", statusCode: 409, title: "That time doesn’t fit your review"),
                _ => Results.NotFound(),
            });

        // Buyers see their own inspections, mechanics and body shops only those assigned to them (L2-057, L2-058).
        var inspections = app.MapGroup("/api/inspections").RequireAuthorization(Policies.Inspections);
        inspections.MapGet("", async (IMediator m, CancellationToken ct) => Results.Ok(new { inspections = await m.Send(new ListInspectionsQuery(), ct) }));
        inspections.MapGet("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new GetInspectionQuery(id), ct) is { } i ? Results.Ok(i) : Results.NotFound());

        // Only the buyer who booked can move or cancel it (ADR 0009).
        var change = app.MapGroup("/api/inspections/{id:guid}").RequireAuthorization(Policies.Buyer);
        change.MapGet("/reschedule-slots", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new RescheduleSlotsQuery(id), ct) is { } slots ? Results.Ok(new { slots }) : Results.NotFound());
        change.MapPost("/reschedule", async (Guid id, RescheduleRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new RescheduleInspectionCommand(id, r.Start), ct)));
        change.MapPost("/cancel", async (Guid id, CancelRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new CancelInspectionCommand(id, r.Reason), ct)));
        return app;
    }

    private static IResult Respond(ChangeResult result) => result switch
    {
        ChangeResult.Done d => Results.Ok(d.Inspection),
        ChangeResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
        ChangeResult.SlotUnavailable => Results.Problem("Your original time is still booked. Try again.", statusCode: 409, title: "We couldn’t move the call"),
        ChangeResult.NotAllowed => Results.Problem("The call has started or the inspection is cancelled, so it can’t be changed.", statusCode: 409, title: "That inspection can’t be changed"),
        _ => Results.NotFound(),
    };

    private static IResult SlotTaken() =>
        Results.Problem("Someone just took it. Pick another time and you won’t lose your answers.", statusCode: 409, title: "We couldn’t hold that slot");
}

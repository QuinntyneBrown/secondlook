using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Bookings;

namespace SecondLook.Api.Bookings;

public static class HistoryEndpoints
{
    public static IEndpointRouteBuilder MapHistoryEndpoints(this IEndpointRouteBuilder app)
    {
        // The buyer's own inspections, in pages, with the estimate of each (L2-019 to L2-022).
        app.MapGet("/api/inspections/history", async (string? tab, string? page, IMediator m, CancellationToken ct) =>
            await m.Send(new GetHistoryQuery(tab, page), ct) switch
            {
                HistoryResult.Ok ok => Results.Ok(ok.History),
                _ => Results.ValidationProblem(new Dictionary<string, string[]> { ["tab"] = ["Use Active or Past."] }),
            }).RequireAuthorization(Policies.Buyer);
        return app;
    }
}

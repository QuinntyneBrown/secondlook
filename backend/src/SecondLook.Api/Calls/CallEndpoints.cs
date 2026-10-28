using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Calls;

namespace SecondLook.Api.Calls;

public sealed record NoteRequest(string? Text);

public static class CallEndpoints
{
    public static IEndpointRouteBuilder MapCallEndpoints(this IEndpointRouteBuilder app)
    {
        // The buyer and the assigned providers only; anyone else's call is absent (ADR 0012).
        var calls = app.MapGroup("/api/calls/{id:guid}").RequireAuthorization(Policies.Inspections);

        calls.MapGet("", async (Guid id, IMediator m, CancellationToken ct) => Respond(await m.Send(new GetCallQuery(id), ct)));
        calls.MapPost("/join", async (Guid id, IMediator m, CancellationToken ct) => Respond(await m.Send(new JoinCallCommand(id), ct)));
        calls.MapPost("/end", async (Guid id, IMediator m, CancellationToken ct) => Respond(await m.Send(new EndCallCommand(id), ct)));
        calls.MapPost("/checklist/advance", async (Guid id, IMediator m, CancellationToken ct) => Respond(await m.Send(new AdvanceChecklistCommand(id), ct)));
        calls.MapPost("/notes", async (Guid id, NoteRequest r, IMediator m, CancellationToken ct) => Respond(await m.Send(new AddNoteCommand(id, r.Text), ct)));

        calls.Map("/ws", async (Guid id, HttpContext http, IMediator m, CallHub hub, CancellationToken ct) =>
        {
            if (!http.WebSockets.IsWebSocketRequest) return Results.Problem("Open this address as a WebSocket.", statusCode: 400, title: "Not a WebSocket request");
            switch (await m.Send(new OpenSocketQuery(id), ct))
            {
                case SocketAccess.Allowed a:
                    using (var socket = await http.WebSockets.AcceptWebSocketAsync())
                        await hub.RunAsync(id, a.UserId, a.Name, a.Role, socket, http.RequestAborted);
                    return Results.Empty;
                case SocketAccess.NotLive:
                    return Results.Problem("Join the call first; it may have ended.", statusCode: 409, title: "The call isn’t live");
                default:
                    return Results.NotFound();
            }
        });
        return app;
    }

    private static IResult Respond(CallResult result) => result switch
    {
        CallResult.Ok o => Results.Ok(o.State),
        CallResult.NotYetOpen n => Results.Problem("You can join 15 minutes before the call starts.", statusCode: 409, title: "The call isn’t open yet", extensions: new Dictionary<string, object?> { ["opensAt"] = n.OpensAt }),
        CallResult.NotAllowed n => Results.Problem(n.Detail, statusCode: 409, title: "That call can’t be joined"),
        CallResult.Forbidden => Results.Problem("Only the mechanic can do that during the call.", statusCode: 403, title: "Not allowed"),
        CallResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
        _ => Results.NotFound(),
    };
}

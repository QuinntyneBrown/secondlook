using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Accounts;

namespace SecondLook.Api.Accounts;

public sealed record OnboardProviderRequest(string? Kind, string? DisplayName, string? Email, string? LicenceNumber, string? Location);

public static class AdminProviderEndpoints
{
    public static IEndpointRouteBuilder MapAdminProviderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin/providers").RequireAuthorization(Policies.Admin);

        group.MapGet("", async (string? status, string? kind, IMediator m, CancellationToken ct) =>
            Results.Ok(await m.Send(new ListProvidersQuery(status, kind), ct)));

        group.MapGet("/{id:guid}", async (Guid id, IMediator m, CancellationToken ct) =>
            await m.Send(new GetProviderQuery(id), ct) is { } p ? Results.Ok(p) : Results.NotFound());

        group.MapPost("", async (OnboardProviderRequest r, IMediator m, CancellationToken ct) =>
            await m.Send(new OnboardProviderCommand(r.Kind, r.DisplayName, r.Email, r.LicenceNumber, r.Location), ct) switch
            {
                OnboardResult.Created c => Results.Created($"/api/admin/providers/{c.Provider.Id}", c.Provider),
                OnboardResult.Existing e => Results.Ok(e.Provider),
                OnboardResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(x => x.Key, x => x.Value)),
                _ => Results.Problem("That email already belongs to another kind of account.", statusCode: 409, title: "Account exists"),
            });

        group.MapPost("/{id:guid}/approve", async (Guid id, IMediator m, CancellationToken ct) =>
            Outcome(await m.Send(new ApproveProviderCommand(id), ct), "Only a pending or deactivated provider can be approved."));

        group.MapPost("/{id:guid}/deactivate", async (Guid id, IMediator m, CancellationToken ct) =>
            Outcome(await m.Send(new DeactivateProviderCommand(id), ct), "Only an approved provider can be deactivated."));
        return app;
    }

    private static IResult Outcome(TransitionOutcome outcome, string conflict) => outcome switch
    {
        TransitionOutcome.Done => Results.Ok(),
        TransitionOutcome.NotFound => Results.NotFound(),
        _ => Results.Problem(conflict, statusCode: 409, title: "That change isn’t allowed"),
    };
}

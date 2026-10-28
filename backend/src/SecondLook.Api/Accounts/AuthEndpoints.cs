using MediatR;
using SecondLook.Application.Accounts;

namespace SecondLook.Api.Accounts;

public sealed record RegisterRequest(string? FullName, string? Email, string? Password, bool AcceptedTerms, string? Role);

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // Intentional anonymous endpoints: the caller has no account or session yet.
        var auth = app.MapGroup("/api/auth").AllowAnonymous();

        auth.MapPost("/register", async (RegisterRequest r, IMediator mediator, CancellationToken ct) =>
            await mediator.Send(new RegisterCommand(r.FullName, r.Email, r.Password, r.AcceptedTerms, r.Role), ct) switch
            {
                RegisterResult.Created c => Results.Created($"/api/platform/me", new { userId = c.UserId, email = c.Email, verificationRequired = true }),
                RegisterResult.Conflict => Results.Problem("There’s already an account for that email.", statusCode: 409, title: "Account exists"),
                RegisterResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
                _ => Results.StatusCode(500),
            });
        return app;
    }
}

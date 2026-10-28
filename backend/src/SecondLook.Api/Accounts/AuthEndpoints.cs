using MediatR;
using SecondLook.Application.Accounts;

namespace SecondLook.Api.Accounts;

public sealed record RegisterRequest(string? FullName, string? Email, string? Password, bool AcceptedTerms, string? Role);
public sealed record TokenRequest(string? Token);
public sealed record EmailRequest(string? Email);
public sealed record LoginRequest(string? Email, string? Password);

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        // Intentional anonymous endpoints: the caller has no account or session yet.
        var auth = app.MapGroup("/api/auth").AllowAnonymous();

        auth.MapPost("/register", async (RegisterRequest r, IMediator mediator, CancellationToken ct) =>
            await mediator.Send(new RegisterCommand(r.FullName, r.Email, r.Password, r.AcceptedTerms, r.Role), ct) switch
            {
                RegisterResult.Created c => Results.Created("/api/platform/me", new { userId = c.UserId, email = c.Email, verificationRequired = true }),
                RegisterResult.Conflict => Results.Problem("There’s already an account for that email.", statusCode: 409, title: "Account exists"),
                RegisterResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
                _ => Results.StatusCode(500),
            });

        auth.MapPost("/verify-email", async (TokenRequest r, IMediator mediator, CancellationToken ct) =>
            await mediator.Send(new VerifyEmailCommand(r.Token), ct) switch
            {
                AccountTokens.Outcome.Ok => Results.Ok(new { verified = true }),
                AccountTokens.Outcome.Expired => Results.Problem("Verification links work for 24 hours. We can send a new one.", statusCode: 410, title: "That link has expired"),
                _ => Results.Problem("That verification link isn’t valid.", statusCode: 400, title: "We couldn’t verify that link"),
            });

        auth.MapPost("/resend-verification", async (EmailRequest r, IMediator mediator, CancellationToken ct) =>
        {
            await mediator.Send(new ResendVerificationCommand(r.Email), ct);
            return Results.Accepted();
        });

        auth.MapPost("/login", async (LoginRequest r, IMediator mediator, CancellationToken ct) =>
            await mediator.Send(new LoginCommand(r.Email, r.Password), ct) switch
            {
                LoginResult.SignedIn s => Results.Ok(new { token = s.Token, role = s.Role.ToString(), isApproved = s.IsApproved, displayName = s.DisplayName }),
                LoginResult.EmailNotVerified => Results.Problem("Open the link we emailed you, or ask for a new one.", statusCode: 403, title: "Verify your email to sign in"),
                LoginResult.Invalid i => Results.ValidationProblem(i.Errors.ToDictionary(e => e.Key, e => e.Value)),
                _ => Results.Problem("Check them and try again, or reset your password.", statusCode: 401, title: "That email and password don’t match"),
            });
        return app;
    }
}

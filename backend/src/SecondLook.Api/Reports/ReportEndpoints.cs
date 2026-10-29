using MediatR;
using SecondLook.Api.Auth;
using SecondLook.Application.Reports;

namespace SecondLook.Api.Reports;

public sealed record SubmitReportRequest(List<FindingInput>? Findings);
public sealed record ShareRequest(bool IncludeBodyShop);
public sealed record EmailShareRequest(string? Email);
public sealed record ReportIssueRequest(string? Reason, string? Details);

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        // The buyer and the assigned providers only; anyone else's report is absent (ADR 0013).
        var report = app.MapGroup("/api/inspections/{id:guid}/report").RequireAuthorization(Policies.Inspections);

        report.MapGet("", async (Guid id, IMediator m, CancellationToken ct) => Respond(await m.Send(new GetReportQuery(id), ct)));
        report.MapPut("", async (Guid id, SubmitReportRequest r, IMediator m, CancellationToken ct) => Respond(await m.Send(new SubmitReportCommand(id, r.Findings), ct)));
        report.MapPut("/body-shop", async (Guid id, SubmitReportRequest r, IMediator m, CancellationToken ct) => Respond(await m.Send(new SubmitBodyShopReviewCommand(id, r.Findings), ct)));
        report.MapGet("/pdf", async (Guid id, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new GetReportPdfQuery(id), ct), bytes => Results.File(bytes, "application/pdf", "secondlook-report.pdf")));
        report.MapPut("/share", async (Guid id, ShareRequest r, IMediator m, CancellationToken ct) => Respond(await m.Send(new EnsureShareCommand(id, r.IncludeBodyShop), ct)));
        report.MapPost("/share/email", async (Guid id, EmailShareRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new EmailShareCommand(id, r.Email), ct), sentTo => Results.Ok(new { sentTo })));
        report.MapDelete("/share", async (Guid id, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new RevokeShareCommand(id), ct), _ => Results.NoContent()));
        report.MapPost("/issues", async (Guid id, ReportIssueRequest r, IMediator m, CancellationToken ct) =>
            Respond(await m.Send(new ReportIssueCommand(id, r.Reason, r.Details), ct), issueId => Results.Created($"/api/inspections/{id}/report/issues/{issueId}", new { id = issueId })));

        // The buyer's cars from their latest pricing window, lined up (L2-051).
        app.MapGet("/api/comparisons", async (IMediator m, CancellationToken ct) => Results.Ok(await m.Send(new GetComparisonQuery(), ct))).RequireAuthorization(Policies.Buyer);

        // The body shop's queue of its own inspections (L2-058).
        app.MapGet("/api/reviews/assigned", async (IMediator m, CancellationToken ct) => Results.Ok(await m.Send(new ListAssignedReviewsQuery(), ct))).RequireAuthorization(Policies.BodyShop);

        // Intentional anonymous endpoint: anyone with a live share link reads the report without an account (L2-047).
        app.MapGet("/api/shared-reports/{token}", async (string token, IMediator m, CancellationToken ct) =>
        {
            var result = await m.Send(new GetSharedReportQuery(token), ct);
            return result.Failure is null
                ? Results.Ok(result.Value)
                : Results.Problem("The owner turned off the link. Ask them for a new one.", statusCode: 404, title: "This report isn’t shared with you");
        }).AllowAnonymous();
        return app;
    }

    private static IResult Respond<T>(ReportOutcome<T> result, Func<T, IResult>? ok = null) => result.Failure switch
    {
        null => ok is null ? Results.Ok(result.Value) : ok(result.Value!),
        ReportFailure.Forbidden => Results.Problem("That isn’t yours to do on this inspection.", statusCode: 403, title: "Not allowed"),
        ReportFailure.NotReady => Results.Problem(result.Detail ?? "The mechanic is still writing it.", statusCode: 409, title: "Your report isn’t ready yet"),
        ReportFailure.Conflict => Results.Problem(result.Detail, statusCode: 409, title: "That can’t be done yet"),
        ReportFailure.Invalid => Results.ValidationProblem(result.Errors!.ToDictionary(e => e.Key, e => e.Value)),
        _ => Results.NotFound(),
    };
}

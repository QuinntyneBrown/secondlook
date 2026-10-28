using System.Net;
using System.Text.Json;
using FluentAssertions;

namespace SecondLook.Api.Tests.Platform;

public class ErrorHandlingTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public ErrorHandlingTests(ApiFactory factory) => _factory = factory;

    // L2-071 AC1: a server fault returns problem+json with a trace id and no internals.
    [Fact]
    public async Task Server_fault_returns_problem_details_without_internals()
    {
        var response = await _factory.ClientFor("Admin").GetAsync("/api/platform/diagnostics/fault");
        response.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var raw = await response.Content.ReadAsStringAsync();
        var body = JsonDocument.Parse(raw).RootElement;
        body.GetProperty("status").GetInt32().Should().Be(500);
        body.GetProperty("traceId").GetString().Should().NotBeNullOrEmpty();
        raw.Should().NotContain("at SecondLook").And.NotContain("StackTrace").And.NotContain("deliberate platform fault");
    }

    // L2-071 AC2: request logging sits outside exception handling, so the handled status is logged.
    [Fact]
    public async Task Request_log_records_the_handled_status_and_never_the_token()
    {
        var client = _factory.ClientFor("Admin");
        var token = client.DefaultRequestHeaders.Authorization!.Parameter!;
        await client.GetAsync("/api/platform/diagnostics/fault");
        string[] logs;
        lock (_factory.Logs) logs = _factory.Logs.ToArray();
        logs.Should().Contain(l => l.Contains("RequestLogging") && l.Contains("/api/platform/diagnostics/fault") && l.Contains("500"));
        logs.Should().NotContain(l => l.Contains(token));
    }

    // L2-071 AC3: an unknown route is a problem+json 404.
    [Fact]
    public async Task Unknown_route_is_problem_json_404()
    {
        var response = await _factory.ClientFor("Buyer").GetAsync("/api/nope");
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }
}

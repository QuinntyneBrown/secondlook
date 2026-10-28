using System.Net;
using FluentAssertions;

namespace SecondLook.Api.Tests.Platform;

public class HealthTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public HealthTests(ApiFactory factory) => _factory = factory;

    // L2-068 AC1: liveness is anonymous.
    [Fact]
    public async Task Liveness_is_anonymous_and_ok()
    {
        var response = await _factory.ClientFor(null).GetAsync("/health/live");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // L2-068 AC2: readiness is anonymous and reports the database reachable.
    [Fact]
    public async Task Readiness_is_anonymous_and_ok_when_database_reachable()
    {
        var response = await _factory.ClientFor(null).GetAsync("/health/ready");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

using FluentAssertions;

namespace SecondLook.Api.Tests.Platform;

public class CorsTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public CorsTests(ApiFactory factory) => _factory = factory;

    // L2-072: the buyer and admin shells (dev origins) may call the API; other origins may not.
    [Theory]
    [InlineData("http://localhost:4200", true)]
    [InlineData("http://localhost:4300", true)]
    [InlineData("https://evil.example", false)]
    public async Task Cross_origin_access_is_limited_to_configured_origins(string origin, bool allowed)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/health/ready");
        request.Headers.Add("Origin", origin);
        var response = await _factory.ClientFor(null).SendAsync(request);
        response.Headers.Contains("Access-Control-Allow-Origin").Should().Be(allowed);
    }
}

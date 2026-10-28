using System.Diagnostics;

namespace SecondLook.Api.Platform;

/// <summary>
/// Logs method, path and the final status. Registered before the exception handler so a handled
/// fault is logged with its 500 response. Never logs headers, query strings or bodies.
/// </summary>
public sealed class RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var started = Stopwatch.GetTimestamp();
        try
        {
            await next(context);
        }
        finally
        {
            logger.LogInformation("RequestLogging {Method} {Path} responded {StatusCode} in {ElapsedMs:0.0} ms",
                context.Request.Method, context.Request.Path.Value, context.Response.StatusCode,
                Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }
}

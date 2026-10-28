using Microsoft.EntityFrameworkCore;
using SecondLook.Api.Auth;
using SecondLook.Api.Platform;
using SecondLook.Infrastructure;
using SecondLook.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSecondLookAuth(builder.Configuration);
builder.Services.AddProblemDetails();

var app = builder.Build();

if (DatabaseSettings.Provider(app.Configuration) == "Sqlite")
{
    // SQLite hosts (tests, e2e, demos) build the schema from the model; SQL Server uses `secondlook migrate`.
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
}

app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformEndpoints();

app.MapGet("/health/live", () => Results.Ok(new { status = "live" })).AllowAnonymous();
app.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct)
        ? Results.Ok(new { status = "ready" })
        : Results.Problem("The database is not reachable.", statusCode: 503, title: "Not ready"))
    .AllowAnonymous();

app.Run();

public partial class Program;

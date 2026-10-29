using SecondLook.Api.Reports;
using SecondLook.Api.Calls;
using Microsoft.EntityFrameworkCore;
using SecondLook.Api.Accounts;
using SecondLook.Api.Auth;
using SecondLook.Api.Availability;
using SecondLook.Api.Bookings;
using SecondLook.Api.Payments;
using SecondLook.Api.Vehicles;
using SecondLook.Api.Platform;
using SecondLook.Infrastructure;
using SecondLook.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddSecondLookAuth(builder.Configuration);
builder.Services.AddSingleton(new SecondLook.Application.Calls.CallOptions(TimeSpan.FromMinutes(builder.Configuration.GetValue("SecondLook:Calls:OpensBeforeMinutes", 15))));
builder.Services.AddSingleton<SecondLook.Api.Calls.CallHub>();
builder.Services.AddSingleton<SecondLook.Application.Abstractions.ICallChannel>(sp => sp.GetRequiredService<SecondLook.Api.Calls.CallHub>());
builder.Services.AddMediatR(c => c.RegisterServicesFromAssemblyContaining<SecondLook.Application.Accounts.RegisterCommand>());
var origins = builder.Configuration.GetSection("SecondLook:Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
    ctx.ProblemDetails.Extensions["traceId"] = System.Diagnostics.Activity.Current?.Id ?? ctx.HttpContext.TraceIdentifier);

var app = builder.Build();

if (DatabaseSettings.Provider(app.Configuration) == "Sqlite")
{
    // SQLite hosts (tests, e2e, demos) build the schema from the model; SQL Server uses `secondlook migrate`.
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
}

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseExceptionHandler();
if (app.Environment.IsDevelopment())
{
    // Swagger is middleware ahead of authorization, so it stays anonymous in Development only.
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseStatusCodePages();
app.UseCors();
app.UseWebSockets();
app.UseAuthentication();
app.UseAuthorization();
app.MapPlatformEndpoints();
app.MapAuthEndpoints();
app.MapAdminProviderEndpoints();
app.MapAvailabilityEndpoints();
app.MapVehicleEndpoints();
app.MapPaymentEndpoints();
app.MapBookingEndpoints();
app.MapCallEndpoints();
app.MapReportEndpoints();
app.MapHistoryEndpoints();

app.MapGet("/health/live", () => Results.Ok(new { status = "live" })).AllowAnonymous();
app.MapGet("/health/ready", async (AppDbContext db, CancellationToken ct) =>
    {
        try
        {
            await db.Users.AnyAsync(ct);
            return Results.Ok(new { status = "ready" });
        }
        catch (Exception)
        {
            return Results.Problem("The service is not ready.", statusCode: 503, title: "Not ready");
        }
    })
    .AllowAnonymous();

app.Run();

public partial class Program;

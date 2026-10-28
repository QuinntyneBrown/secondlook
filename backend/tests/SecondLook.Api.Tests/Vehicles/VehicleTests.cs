using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Domain.Users;
using SecondLook.Infrastructure.Persistence;

namespace SecondLook.Api.Tests.Vehicles;

public class VehicleTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public VehicleTests(ApiFactory factory) => _factory = factory;

    private HttpClient Buyer => _factory.ClientFor("Buyer");

    private static int _vinCounter = 100000;

    /// <summary>A valid 17-character VIN, unique per call.</summary>
    private static string NewVin() => $"2HGFC2F59GH{Interlocked.Increment(ref _vinCounter)}";

    private static object Body(string vin, string phone = "905-555-0142", string name = "Sam Whitaker", int km = 142300, decimal price = 8900m, string? url = "https://example.test/civic") =>
        new { vin, odometerKm = km, askingPrice = price, listingUrl = url, sellerName = name, sellerPhone = phone };

    private async Task<JsonElement> Add(HttpClient client, string? vin = null)
    {
        var response = await client.PostAsJsonAsync("/api/vehicles", Body(vin ?? NewVin()));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static Guid Id(JsonElement e) => e.GetProperty("id").GetGuid();

    private async Task<JsonElement[]> List(HttpClient client) =>
        (await (await client.GetAsync("/api/vehicles")).Content.ReadFromJsonAsync<JsonElement>()).EnumerateArray().ToArray();

    // L2-063 AC1: a vehicle is saved to the buyer's account with normalised values.
    [Fact]
    public async Task A_buyer_saves_a_vehicle()
    {
        var vin = NewVin();
        var created = await Client(vin);
        created.GetProperty("vin").GetString().Should().Be(vin);
        created.GetProperty("sellerPhone").GetString().Should().Be("9055550142");
        created.GetProperty("odometerKm").GetInt32().Should().Be(142300);
        created.GetProperty("askingPrice").GetDecimal().Should().Be(8900m);
        (await List(Buyer)).Select(Id).Should().Contain(Id(created));

        async Task<JsonElement> Client(string v) => await Add(Buyer, v.ToLowerInvariant());
    }

    // L2-023 AC3 style validation: every invalid field is listed.
    [Fact]
    public async Task Invalid_vehicles_list_each_field_error()
    {
        var response = await Buyer.PostAsJsonAsync("/api/vehicles", Body("2HGFC2F59GH51234", phone: "905-555-01", name: "", km: -1, price: -5m, url: "ftp://nope"));
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        errors.GetProperty("vin")[0].GetString().Should().Be("Enter the full 17-character VIN.");
        errors.GetProperty("sellerPhone")[0].GetString().Should().Be("Enter the seller’s 10-digit phone number.");
        foreach (var field in new[] { "sellerName", "odometerKm", "askingPrice", "listingUrl" })
            errors.TryGetProperty(field, out _).Should().BeTrue(field);
    }

    [Theory]
    [InlineData("2HGFC2F59GH5123IO")] // I and O are not allowed in a VIN
    [InlineData("2HGFC2F59GH5123Q9")]
    public async Task VINs_with_forbidden_letters_are_rejected(string vin)
    {
        (await Buyer.PostAsJsonAsync("/api/vehicles", Body(vin))).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Theory]
    [InlineData("(905) 555-0142", "9055550142")]
    [InlineData("1-905-555-0142", "9055550142")]
    [InlineData("905.555.0142", "9055550142")]
    public async Task Phone_numbers_are_normalised(string phone, string expected)
    {
        var response = await Buyer.PostAsJsonAsync("/api/vehicles", Body(NewVin(), phone));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("sellerPhone").GetString().Should().Be(expected);
    }

    [Fact]
    public async Task The_listing_link_is_optional()
    {
        var response = await Buyer.PostAsJsonAsync("/api/vehicles", Body(NewVin(), url: null));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // ADR 0006: the same VIN cannot be saved twice by one buyer.
    [Fact]
    public async Task A_duplicate_vin_is_a_conflict_for_the_same_buyer_only()
    {
        var vin = NewVin();
        await Add(Buyer, vin);
        var again = await Buyer.PostAsJsonAsync("/api/vehicles", Body(vin));
        again.StatusCode.Should().Be(HttpStatusCode.Conflict);
        again.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        // A different buyer may save the same VIN.
        (await OtherBuyer().PostAsJsonAsync("/api/vehicles", Body(vin))).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // L2-063 AC2: edits are saved.
    [Fact]
    public async Task A_vehicle_can_be_edited()
    {
        var created = await Add(Buyer);
        var id = Id(created);
        var vin = created.GetProperty("vin").GetString()!;
        var response = await Buyer.PutAsJsonAsync($"/api/vehicles/{id}", Body(vin, name: "Priya Nair", km: 150000, price: 8400m));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var edited = await response.Content.ReadFromJsonAsync<JsonElement>();
        edited.GetProperty("sellerName").GetString().Should().Be("Priya Nair");
        edited.GetProperty("odometerKm").GetInt32().Should().Be(150000);
        (await List(Buyer)).Single(v => Id(v) == id).GetProperty("askingPrice").GetDecimal().Should().Be(8400m);
    }

    [Fact]
    public async Task Editing_into_another_saved_vin_is_a_conflict()
    {
        var first = await Add(Buyer);
        var second = await Add(Buyer);
        var response = await Buyer.PutAsJsonAsync($"/api/vehicles/{Id(second)}", Body(first.GetProperty("vin").GetString()!));
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // L2-063 AC3 + ADR 0006: removal drops it from the list but keeps the row; a removed VIN can be saved again.
    [Fact]
    public async Task A_removed_vehicle_is_no_longer_listed_but_is_kept_and_can_be_saved_again()
    {
        var created = await Add(Buyer);
        var id = Id(created);
        var vin = created.GetProperty("vin").GetString()!;
        (await Buyer.DeleteAsync($"/api/vehicles/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await List(Buyer)).Select(Id).Should().NotContain(id);
        (await Buyer.GetAsync($"/api/vehicles/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Buyer.DeleteAsync($"/api/vehicles/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);

        using (var scope = _factory.Services.CreateScope())
        {
            var row = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.SingleAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>().Vehicles, v => v.Id == id);
            row.RemovedAt.Should().NotBeNull();
            row.Vin.Should().Be(vin);
        }
        (await Buyer.PostAsJsonAsync("/api/vehicles", Body(vin))).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // L2-057: another buyer's vehicles are never exposed.
    [Fact]
    public async Task Buyers_see_and_change_only_their_own_vehicles()
    {
        var mine = Id(await Add(Buyer));
        var other = OtherBuyer();
        (await List(other)).Select(Id).Should().NotContain(mine);
        (await other.GetAsync($"/api/vehicles/{mine}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.PutAsJsonAsync($"/api/vehicles/{mine}", Body(NewVin()))).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await other.DeleteAsync($"/api/vehicles/{mine}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await List(Buyer)).Select(Id).Should().Contain(mine);
    }

    [Theory]
    [InlineData("Mechanic")]
    [InlineData("BodyShop")]
    [InlineData("Admin")]
    public async Task Only_buyers_use_saved_vehicles(string role)
    {
        (await _factory.ClientFor(role).GetAsync("/api/vehicles")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(role).PostAsJsonAsync("/api/vehicles", Body(NewVin()))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Anonymous_callers_are_unauthorized()
    {
        (await _factory.ClientFor(null).GetAsync("/api/vehicles")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    /// <summary>A second, real buyer account so ownership is exercised with two different users.</summary>
    private HttpClient OtherBuyer()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var existing = db.Users.FirstOrDefault(u => u.Email == "other.buyer@example.test");
        if (existing is null)
        {
            existing = new User { Id = Guid.NewGuid(), Email = "other.buyer@example.test", DisplayName = "Other Buyer", Role = UserRole.Buyer, EmailVerified = true };
            db.Users.Add(existing);
            db.SaveChanges();
        }
        return _factory.ClientFor("Buyer", existing.Id);
    }
}

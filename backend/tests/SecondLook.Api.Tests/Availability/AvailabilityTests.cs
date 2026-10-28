using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using SecondLook.Application.Availability;
using SecondLook.Domain.Availability;
using SecondLook.Domain.Users;

namespace SecondLook.Api.Tests.Availability;

public class AvailabilityTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public AvailabilityTests(ApiFactory factory) => _factory = factory;

    private HttpClient Mechanic => _factory.ClientFor("Mechanic");
    private HttpClient Shop => _factory.ClientFor("BodyShop");
    private HttpClient Buyer => _factory.ClientFor("Buyer");

    private static int _dayCounter = 20;

    /// <summary>A fresh future day at 14:00 UTC so tests never overlap one another.</summary>
    private static DateTimeOffset NextDay() =>
        new(DateTimeOffset.UtcNow.Date.AddDays(Interlocked.Increment(ref _dayCounter)).AddHours(14), TimeSpan.Zero);

    private static object Window(DateTimeOffset start, int hours = 2) => new { start, end = start.AddHours(hours) };

    private static Guid Id(JsonElement e) => e.GetProperty("id").GetGuid();

    private async Task<JsonElement> Add(HttpClient client, DateTimeOffset start, int hours = 2)
    {
        var response = await client.PostAsJsonAsync("/api/availability", Window(start, hours));
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    private async Task<JsonElement[]> Slots(DateTimeOffset from, DateTimeOffset to, string? kind = null)
    {
        var url = $"/api/slots?from={Uri.EscapeDataString(from.ToString("O"))}&to={Uri.EscapeDataString(to.ToString("O"))}" + (kind is null ? "" : $"&kind={kind}");
        var response = await Buyer.GetAsync(url);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("slots").EnumerateArray().ToArray();
    }

    private async Task Reserve(Guid providerId, DateTimeOffset start, ReservationStatus status = ReservationStatus.Booked, TimeSpan? holdFor = null)
    {
        using var scope = _factory.Services.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new ReserveSlotCommand(providerId, start, status, holdFor));
        result.Should().BeOfType<ReserveSlotResult.Reserved>();
    }

    // L2-061 AC1: a provider saves a window and sees it listed.
    [Fact]
    public async Task A_provider_saves_and_lists_its_windows()
    {
        var start = NextDay();
        var created = await Add(Mechanic, start);
        created.GetProperty("start").GetDateTimeOffset().Should().Be(start);
        var list = await (await Mechanic.GetAsync("/api/availability")).Content.ReadFromJsonAsync<JsonElement>();
        list.EnumerateArray().Select(Id).Should().Contain(Id(created));
    }

    [Fact]
    public async Task Windows_are_validated()
    {
        var start = NextDay();
        async Task<JsonElement> Post(object body)
        {
            var response = await Mechanic.PostAsJsonAsync("/api/availability", body);
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("errors");
        }
        (await Post(new { start, end = start })).TryGetProperty("end", out _).Should().BeTrue();
        (await Post(new { start = DateTimeOffset.UtcNow.AddDays(-1), end = DateTimeOffset.UtcNow.AddDays(-1).AddHours(2) })).TryGetProperty("start", out _).Should().BeTrue();
        (await Post(new { start = start.AddMinutes(10), end = start.AddHours(2) })).TryGetProperty("start", out _).Should().BeTrue();
        (await Post(new { start, end = start.AddHours(13) })).TryGetProperty("end", out _).Should().BeTrue();
    }

    // Overlap: a provider cannot save overlapping windows, but adjacent windows are fine.
    [Fact]
    public async Task Overlapping_windows_are_a_conflict_but_adjacent_ones_are_not()
    {
        var start = NextDay();
        await Add(Mechanic, start, 2);
        (await Mechanic.PostAsJsonAsync("/api/availability", Window(start.AddHours(1), 2))).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Mechanic.PostAsJsonAsync("/api/availability", Window(start.AddHours(2), 1))).StatusCode.Should().Be(HttpStatusCode.Created);
    }

    // Edit and remove.
    [Fact]
    public async Task A_window_can_be_edited_and_removed()
    {
        var start = NextDay();
        var id = Id(await Add(Mechanic, start));
        var edited = await Mechanic.PutAsJsonAsync($"/api/availability/{id}", Window(start.AddHours(1), 3));
        edited.StatusCode.Should().Be(HttpStatusCode.OK);
        (await edited.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("start").GetDateTimeOffset().Should().Be(start.AddHours(1));
        (await Mechanic.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await Mechanic.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // L2-058 style scoping: another provider's window is not found, never forbidden.
    [Fact]
    public async Task A_provider_cannot_touch_another_providers_window()
    {
        var id = Id(await Add(Mechanic, NextDay()));
        (await Shop.PutAsJsonAsync($"/api/availability/{id}", Window(NextDay()))).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Shop.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        var theirs = await (await Shop.GetAsync("/api/availability")).Content.ReadFromJsonAsync<JsonElement>();
        theirs.EnumerateArray().Select(Id).Should().NotContain(id);
    }

    // Roles: buyers and admins cannot manage availability; anonymous callers are 401.
    [Theory]
    [InlineData("Buyer")]
    [InlineData("Admin")]
    public async Task Only_providers_manage_availability(string role)
    {
        (await _factory.ClientFor(role).GetAsync("/api/availability")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await _factory.ClientFor(role).PostAsJsonAsync("/api/availability", Window(NextDay()))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Anonymous_callers_are_unauthorized()
    {
        (await _factory.ClientFor(null).GetAsync("/api/availability")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await _factory.ClientFor(null).GetAsync("/api/slots")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ADR 0005: only approved providers may save windows.
    [Fact]
    public async Task A_pending_provider_cannot_save_availability()
    {
        var anon = _factory.ClientFor(null);
        var email = $"pending{Guid.NewGuid():N}@example.test";
        await anon.PostAsJsonAsync("/api/auth/register", new { fullName = "New Shop", email, password = "a-long-password", acceptedTerms = true, role = "Mechanic" });
        await anon.PostAsJsonAsync("/api/auth/verify-email", new { token = _factory.Mailbox.LastTokenFor(email, "verify-email") });
        var token = (await (await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "a-long-password" })).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!;
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        (await client.PostAsJsonAsync("/api/availability", Window(NextDay()))).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var list = await client.GetAsync("/api/availability");
        list.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await list.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString().Should().Be("Your account isn’t approved yet");
    }

    // L2-061 AC2: slots are 30-minute steps through the window, for approved providers only.
    [Fact]
    public async Task A_window_divides_into_half_hour_slots()
    {
        var start = NextDay();
        await Add(Mechanic, start, 2);
        var slots = (await Slots(start, start.AddHours(2))).Where(s => s.GetProperty("providerId").GetGuid() == ApiFactory.SeededId("Mechanic")).ToArray();
        slots.Select(s => s.GetProperty("start").GetDateTimeOffset()).Should().Equal(start, start.AddMinutes(30), start.AddMinutes(60), start.AddMinutes(90));
        slots[0].GetProperty("end").GetDateTimeOffset().Should().Be(start.AddMinutes(30));
        slots[0].GetProperty("providerName").GetString().Should().Be("Maya Mechanic");
    }

    [Fact]
    public async Task Slots_can_be_filtered_by_kind()
    {
        var start = NextDay();
        await Add(Shop, start, 1);
        (await Slots(start, start.AddHours(1), "BodyShop")).Should().NotBeEmpty();
        (await Slots(start, start.AddHours(1), "Mechanic")).Where(s => s.GetProperty("providerId").GetGuid() == ApiFactory.SeededId("BodyShop")).Should().BeEmpty();
    }

    // L2-061 AC2: reserved times disappear; held times return when the hold expires.
    [Fact]
    public async Task Booked_and_held_slots_are_not_offered()
    {
        var start = NextDay();
        await Add(Mechanic, start, 2);
        var mechanicId = ApiFactory.SeededId("Mechanic");
        await Reserve(mechanicId, start.AddMinutes(30));
        await Reserve(mechanicId, start.AddMinutes(60), ReservationStatus.Held, TimeSpan.FromMinutes(10));
        var offered = (await Slots(start, start.AddHours(2))).Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        offered.Should().Equal(start, start.AddMinutes(90));

        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        var later = (await Slots(start, start.AddHours(2))).Select(s => s.GetProperty("start").GetDateTimeOffset()).ToArray();
        later.Should().Equal(start, start.AddMinutes(60), start.AddMinutes(90));
    }

    // Concurrency: the same slot cannot be reserved twice.
    [Fact]
    public async Task A_slot_can_be_reserved_only_once_even_concurrently()
    {
        var start = NextDay();
        await Add(Mechanic, start, 1);
        var mechanicId = ApiFactory.SeededId("Mechanic");
        var attempts = await Task.WhenAll(Enumerable.Range(0, 5).Select(async _ =>
        {
            using var scope = _factory.Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new ReserveSlotCommand(mechanicId, start, ReservationStatus.Booked, null));
        }));
        attempts.OfType<ReserveSlotResult.Reserved>().Should().HaveCount(1);
        attempts.OfType<ReserveSlotResult.Taken>().Should().HaveCount(4);
    }

    [Fact]
    public async Task A_slot_outside_any_window_cannot_be_reserved()
    {
        using var scope = _factory.Services.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new ReserveSlotCommand(ApiFactory.SeededId("Mechanic"), NextDay().AddDays(40), ReservationStatus.Booked, null));
        result.Should().BeOfType<ReserveSlotResult.NotAvailable>();
    }

    // Removal of booked slots: a window cannot be removed or shrunk over an active reservation.
    [Fact]
    public async Task A_window_cannot_be_removed_or_shrunk_over_a_booked_slot()
    {
        var start = NextDay();
        var id = Id(await Add(Mechanic, start, 2));
        await Reserve(ApiFactory.SeededId("Mechanic"), start.AddMinutes(60));
        (await Mechanic.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Mechanic.PutAsJsonAsync($"/api/availability/{id}", Window(start, 1))).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await Mechanic.PutAsJsonAsync($"/api/availability/{id}", Window(start, 3))).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // A window whose only reservation is an expired hold can still be removed.
    [Fact]
    public async Task An_expired_hold_does_not_block_removal()
    {
        var start = NextDay();
        var id = Id(await Add(Mechanic, start, 1));
        await Reserve(ApiFactory.SeededId("Mechanic"), start, ReservationStatus.Held, TimeSpan.FromMinutes(10));
        (await Mechanic.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.Conflict);
        _factory.Clock.Advance(TimeSpan.FromMinutes(11));
        (await Mechanic.DeleteAsync($"/api/availability/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // Only buyers browse slots.
    [Fact]
    public async Task Only_buyers_browse_slots()
    {
        (await Mechanic.GetAsync("/api/slots")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // A deactivated provider stops contributing slots but keeps its windows.
    [Fact]
    public async Task A_deactivated_provider_stops_appearing_in_slots()
    {
        var start = NextDay();
        await Add(Shop, start, 1);
        (await Slots(start, start.AddHours(1), "BodyShop")).Should().NotBeEmpty();
        var admin = _factory.ClientFor("Admin");
        await admin.PostAsync($"/api/admin/providers/{ApiFactory.SeededId("BodyShop")}/deactivate", null);
        (await Slots(start, start.AddHours(1), "BodyShop")).Should().BeEmpty();
        await admin.PostAsync($"/api/admin/providers/{ApiFactory.SeededId("BodyShop")}/approve", null);
        (await Slots(start, start.AddHours(1), "BodyShop")).Should().NotBeEmpty();
    }
}

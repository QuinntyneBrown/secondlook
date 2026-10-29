using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using SecondLook.Api.Tests.Bookings;

namespace SecondLook.Api.Tests.Calls;

/// <summary>
/// Live inspection calls (ADR 0012). This fixture moves the clock to reach call time, so it has its own host.
/// </summary>
public class CallTests(ApiFactory factory) : BookingFlow(factory), IClassFixture<ApiFactory>
{
    private static readonly TimeSpan Opens = TimeSpan.FromMinutes(15);

    /// <summary>Books an inspection and moves the clock to <paramref name="before"/> ahead of its start.</summary>
    private async Task<(HttpClient buyer, Guid id, DateTimeOffset start)> BookedCall(TimeSpan before)
    {
        var start = await OpenWindow();
        var buyer = NewBuyer();
        var id = await Book(buyer, start);
        Factory.Clock.Advance((start - Factory.Clock.GetUtcNow()) - before);
        return (buyer, id, start);
    }

    private static string Token(HttpClient c) => c.DefaultRequestHeaders.Authorization!.Parameter!;

    private async Task<WebSocket> Connect(Guid id, HttpClient who, bool viaQuery = false)
    {
        var client = Factory.Server.CreateWebSocketClient();
        var uri = new Uri($"ws://localhost/api/calls/{id}/ws" + (viaQuery ? $"?access_token={Token(who)}" : ""));
        if (!viaQuery) client.ConfigureRequest = r => r.Headers["Authorization"] = $"Bearer {Token(who)}";
        return await client.ConnectAsync(uri, CancellationToken.None);
    }

    private static async Task<JsonElement> Next(WebSocket ws, string type)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var buffer = new byte[16 * 1024];
        while (true)
        {
            var result = await ws.ReceiveAsync(buffer, cts.Token);
            if (result.MessageType == WebSocketMessageType.Close) throw new InvalidOperationException($"Closed while waiting for {type}.");
            var message = JsonDocument.Parse(Encoding.UTF8.GetString(buffer, 0, result.Count)).RootElement.Clone();
            if (message.GetProperty("type").GetString() == type) return message;
        }
    }

    private static Task Send(WebSocket ws, object message) =>
        ws.SendAsync(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message)), WebSocketMessageType.Text, true, CancellationToken.None);

    // L2-039: the lobby shows the call time, when it opens and who is here, without joining.
    [Fact]
    public async Task The_lobby_state_shows_the_call_and_its_people()
    {
        var (buyer, id, start) = await BookedCall(TimeSpan.FromHours(2));
        var response = await buyer.GetAsync($"/api/calls/{id}");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Json(response);
        body.GetProperty("status").GetString().Should().Be("NotStarted");
        body.GetProperty("vehicleName").GetString().Should().Be("2016 Honda Civic"); // L2-085 AC5
        body.GetProperty("start").GetDateTimeOffset().Should().Be(start);
        body.GetProperty("opensAt").GetDateTimeOffset().Should().Be(start - Opens);
        var people = body.GetProperty("participants").EnumerateArray().ToArray();
        people.Select(p => p.GetProperty("role").GetString()).Should().Contain(new[] { "Mechanic", "Seller" });
        people.Single(p => p.GetProperty("role").GetString() == "Mechanic").GetProperty("name").GetString().Should().Be("Maya Mechanic");
        people.Should().OnlyContain(p => !p.GetProperty("here").GetBoolean());
        body.GetProperty("checklist").EnumerateArray().Select(c => c.GetProperty("name").GetString()).Should()
            .Equal("Brakes", "Tires", "Suspension", "Steering", "Lights, horn, wipers", "Body panels");
    }

    // ADR 0012: a call opens 15 minutes before its start.
    [Fact]
    public async Task A_call_cannot_be_joined_before_it_opens()
    {
        var (buyer, id, start) = await BookedCall(TimeSpan.FromMinutes(20));
        var early = await buyer.PostAsync($"/api/calls/{id}/join", null);
        early.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await Json(early);
        problem.GetProperty("title").GetString().Should().Be("The call isn’t open yet");
        problem.GetProperty("opensAt").GetDateTimeOffset().Should().Be(start - Opens);

        Factory.Clock.Advance(TimeSpan.FromMinutes(6));
        var open = await buyer.PostAsync($"/api/calls/{id}/join", null);
        open.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(open)).GetProperty("status").GetString().Should().Be("Live");
    }

    // The buyer and the assigned mechanic join the same session; joining twice changes nothing.
    [Fact]
    public async Task Both_participants_join_one_session_idempotently()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        var first = await Json(await buyer.PostAsync($"/api/calls/{id}/join", null));
        var second = await Json(await buyer.PostAsync($"/api/calls/{id}/join", null));
        second.GetProperty("startedAt").GetDateTimeOffset().Should().Be(first.GetProperty("startedAt").GetDateTimeOffset());
        var mechanic = await Mechanic.PostAsync($"/api/calls/{id}/join", null);
        mechanic.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Json(mechanic);
        body.GetProperty("startedAt").GetDateTimeOffset().Should().Be(first.GetProperty("startedAt").GetDateTimeOffset());
        body.GetProperty("you").GetProperty("role").GetString().Should().Be("Mechanic");
    }

    // L2-057, L2-058: nobody else can see or join a call.
    [Fact]
    public async Task Only_the_buyer_and_assigned_providers_can_reach_a_call()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        var intruders = new[] { NewBuyer(), Factory.ClientFor("BodyShop") };
        foreach (var other in intruders)
        {
            (await other.GetAsync($"/api/calls/{id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await other.PostAsync($"/api/calls/{id}/join", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
            (await other.PostAsync($"/api/calls/{id}/end", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
        // Administrators are not call participants.
        (await Factory.ClientFor("Admin").GetAsync($"/api/calls/{id}")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Factory.ClientFor(null).GetAsync($"/api/calls/{id}")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await buyer.PostAsync($"/api/calls/{Guid.NewGuid()}/join", null)).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Signalling: two participants connect, see each other and exchange a signal.
    [Fact]
    public async Task Two_participants_find_each_other_and_exchange_signals()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        await buyer.PostAsync($"/api/calls/{id}/join", null);
        using var b = await Connect(id, buyer);
        var welcomeB = await Next(b, "welcome");
        welcomeB.GetProperty("you").GetProperty("role").GetString().Should().Be("Buyer");
        welcomeB.GetProperty("peers").GetArrayLength().Should().Be(0);

        using var m = await Connect(id, Mechanic, viaQuery: true);
        var welcomeM = await Next(m, "welcome");
        var buyerPeer = welcomeM.GetProperty("peers").EnumerateArray().Single();
        buyerPeer.GetProperty("role").GetString().Should().Be("Buyer");
        var joined = await Next(b, "peer-joined");
        var mechanicId = joined.GetProperty("peer").GetProperty("userId").GetGuid();
        mechanicId.Should().Be(MechanicId);

        await Send(b, new { type = "signal", to = mechanicId, data = new { kind = "offer", sdp = "v=0" } });
        var relayed = await Next(m, "signal");
        relayed.GetProperty("from").GetGuid().Should().Be(buyerPeer.GetProperty("userId").GetGuid());
        relayed.GetProperty("data").GetProperty("sdp").GetString().Should().Be("v=0");

        // Presence is visible in the lobby state while sockets are open.
        var state = await Json(await buyer.GetAsync($"/api/calls/{id}"));
        state.GetProperty("participants").EnumerateArray().Where(p => p.GetProperty("here").GetBoolean()).Select(p => p.GetProperty("role").GetString())
            .Should().BeEquivalentTo("Buyer", "Mechanic");

        await m.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
        (await Next(b, "peer-left")).GetProperty("userId").GetGuid().Should().Be(mechanicId);
    }

    // ADR 0012: a new socket for the same user replaces the old one, keeping the participant's place.
    [Fact]
    public async Task Reconnecting_replaces_the_old_socket_without_announcing_a_departure()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        await buyer.PostAsync($"/api/calls/{id}/join", null);
        using var m = await Connect(id, Mechanic);
        await Next(m, "welcome");
        using var first = await Connect(id, buyer);
        await Next(first, "welcome");
        await Next(m, "peer-joined");

        using var second = await Connect(id, buyer);
        var welcome = await Next(second, "welcome");
        welcome.GetProperty("peers").EnumerateArray().Single().GetProperty("role").GetString().Should().Be("Mechanic");
        (await Next(m, "peer-joined")).GetProperty("peer").GetProperty("role").GetString().Should().Be("Buyer");
        // The replaced socket is told to close.
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
        var buffer = new byte[1024];
        WebSocketReceiveResult read;
        do read = await first.ReceiveAsync(buffer, cts.Token);
        while (read.MessageType != WebSocketMessageType.Close);
        read.CloseStatusDescription.Should().Be("replaced");
    }

    // ADR 0012: the signalling channel is as private as the call.
    [Fact]
    public async Task Intruders_and_unjoined_calls_cannot_open_the_socket()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        // Not joined yet: there is no session.
        var noSession = async () => await Connect(id, buyer);
        await noSession.Should().ThrowAsync<Exception>().WithMessage("*409*");
        await buyer.PostAsync($"/api/calls/{id}/join", null);

        var other = NewBuyer();
        var denied = async () => await Connect(id, other);
        await denied.Should().ThrowAsync<Exception>().WithMessage("*404*");
        var anonymous = async () => await Factory.Server.CreateWebSocketClient().ConnectAsync(new Uri($"ws://localhost/api/calls/{id}/ws"), CancellationToken.None);
        await anonymous.Should().ThrowAsync<Exception>().WithMessage("*401*");
        // A token in the query is accepted on this path only.
        var elsewhere = await Factory.CreateClient().GetAsync($"/api/calls/{id}?access_token={Token(buyer)}");
        elsewhere.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Inspection actions: the mechanic moves the checklist and adds notes; the buyer cannot.
    [Fact]
    public async Task The_mechanic_advances_the_checklist_and_adds_notes()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        await buyer.PostAsync($"/api/calls/{id}/join", null);
        await Mechanic.PostAsync($"/api/calls/{id}/join", null);
        using var b = await Connect(id, buyer);
        await Next(b, "welcome");

        (await buyer.PostAsync($"/api/calls/{id}/checklist/advance", null)).StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await buyer.PostAsJsonAsync($"/api/calls/{id}/notes", new { text = "hi" })).StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var first = await Json(await Mechanic.GetAsync($"/api/calls/{id}"));
        first.GetProperty("checklist").EnumerateArray().Select(c => c.GetProperty("state").GetString())
            .Should().Equal("Now", "Next", "Next", "Next", "Next", "Next");

        var advanced = await Mechanic.PostAsync($"/api/calls/{id}/checklist/advance", null);
        advanced.StatusCode.Should().Be(HttpStatusCode.OK);
        (await Json(advanced)).GetProperty("checklist").EnumerateArray().Select(c => c.GetProperty("state").GetString())
            .Should().Equal("Done", "Now", "Next", "Next", "Next", "Next");
        (await Next(b, "changed")).GetProperty("type").GetString().Should().Be("changed");

        (await Mechanic.PostAsJsonAsync($"/api/calls/{id}/notes", new { text = "" })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await Mechanic.PostAsJsonAsync($"/api/calls/{id}/notes", new { text = new string('x', 501) })).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var note = await Mechanic.PostAsJsonAsync($"/api/calls/{id}/notes", new { text = "Brake pads look thin at the front." });
        note.StatusCode.Should().Be(HttpStatusCode.OK);
        var notes = (await Json(await buyer.GetAsync($"/api/calls/{id}"))).GetProperty("notes").EnumerateArray().ToArray();
        notes.Single().GetProperty("text").GetString().Should().Be("Brake pads look thin at the front.");
        notes.Single().GetProperty("author").GetString().Should().Be("Maya Mechanic");

        for (var i = 0; i < 8; i++) await Mechanic.PostAsync($"/api/calls/{id}/checklist/advance", null);
        (await Json(await buyer.GetAsync($"/api/calls/{id}"))).GetProperty("checklist").EnumerateArray().Select(c => c.GetProperty("state").GetString())
            .Should().OnlyContain(s => s == "Done");
    }

    // L2-043: ending is for everyone, happens once, and leaves a summary.
    [Fact]
    public async Task Ending_the_call_ends_it_for_everyone_once()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromMinutes(10));
        await buyer.PostAsync($"/api/calls/{id}/join", null);
        using var b = await Connect(id, buyer);
        await Next(b, "welcome");
        using var m = await Connect(id, Mechanic);
        await Next(m, "welcome");

        Factory.Clock.Advance(TimeSpan.FromMinutes(7));
        var ended = await buyer.PostAsync($"/api/calls/{id}/end", null);
        ended.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Json(ended);
        body.GetProperty("status").GetString().Should().Be("Ended");
        body.GetProperty("durationSeconds").GetInt32().Should().BeInRange(420, 430);
        await Next(m, "ended");
        await Next(b, "ended");

        var again = await Json(await Mechanic.PostAsync($"/api/calls/{id}/end", null));
        again.GetProperty("endedAt").GetDateTimeOffset().Should().Be(body.GetProperty("endedAt").GetDateTimeOffset());
        var join = await Json(await buyer.PostAsync($"/api/calls/{id}/join", null));
        join.GetProperty("status").GetString().Should().Be("Ended");
        var closed = async () => await Connect(id, buyer);
        await closed.Should().ThrowAsync<Exception>().WithMessage("*409*");
    }

    // A cancelled inspection has no call.
    [Fact]
    public async Task A_cancelled_inspection_cannot_be_joined()
    {
        var (buyer, id, _) = await BookedCall(TimeSpan.FromHours(5));
        (await buyer.PostAsJsonAsync($"/api/inspections/{id}/cancel", new { reason = "Other" })).StatusCode.Should().Be(HttpStatusCode.OK);
        Factory.Clock.Advance(TimeSpan.FromHours(4.9));
        (await buyer.PostAsync($"/api/calls/{id}/join", null)).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}

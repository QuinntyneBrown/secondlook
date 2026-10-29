using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using SecondLook.Application.Abstractions;

namespace SecondLook.Api.Calls;

/// <summary>
/// Relays signalling between the participants of a call and tracks who is present (ADR 0012). Rooms live in memory,
/// so one API instance carries a call; media itself flows peer to peer and never touches the server.
/// </summary>
public sealed class CallHub : ICallChannel
{
    private sealed class Peer(Guid userId, string name, string role, WebSocket socket)
    {
        public Guid UserId { get; } = userId;
        public string Name { get; } = name;
        public string Role { get; } = role;
        public WebSocket Socket { get; } = socket;
        public bool Replaced { get; set; }
        private readonly SemaphoreSlim _send = new(1, 1);

        public object Info => new { userId = UserId, name = Name, role = Role };

        public async Task SendAsync(object message)
        {
            if (Socket.State != WebSocketState.Open) return;
            var bytes = JsonSerializer.SerializeToUtf8Bytes(message, JsonSerializerOptions.Web);
            await _send.WaitAsync();
            try
            {
                if (Socket.State == WebSocketState.Open) await Socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (WebSocketException)
            {
                // the peer is gone; its receive loop cleans up
            }
            finally
            {
                _send.Release();
            }
        }
    }

    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, Peer>> _rooms = new();

    public IReadOnlyCollection<Guid> PresentUsers(Guid inspectionId) =>
        _rooms.TryGetValue(inspectionId, out var room) ? room.Keys.ToList() : [];

    public Task NotifyChangedAsync(Guid inspectionId, CancellationToken ct) => Broadcast(inspectionId, null, new { type = "changed" });

    public async Task EndAsync(Guid inspectionId, CancellationToken ct)
    {
        if (!_rooms.TryRemove(inspectionId, out var room)) return;
        foreach (var peer in room.Values)
        {
            peer.Replaced = true; // its receive loop must not announce a departure
            await peer.SendAsync(new { type = "ended" });
            await CloseQuietly(peer.Socket, WebSocketCloseStatus.NormalClosure, "ended");
        }
    }

    /// <summary>Serves one participant's socket until it closes. A new socket for the same user replaces the old one.</summary>
    public async Task RunAsync(Guid inspectionId, Guid userId, string name, string role, WebSocket socket, CancellationToken ct)
    {
        var me = new Peer(userId, name, role, socket);
        var room = _rooms.GetOrAdd(inspectionId, _ => new());
        if (room.TryGetValue(userId, out var old))
        {
            old.Replaced = true;
            await CloseQuietly(old.Socket, (WebSocketCloseStatus)4001, "replaced");
        }
        room[userId] = me;

        await me.SendAsync(new { type = "welcome", you = me.Info, peers = room.Values.Where(p => p.UserId != userId).Select(p => p.Info).ToList() });
        await Broadcast(inspectionId, userId, new { type = "peer-joined", peer = me.Info });

        var buffer = new byte[64 * 1024];
        try
        {
            while (socket.State == WebSocketState.Open && !ct.IsCancellationRequested)
            {
                using var message = new MemoryStream();
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(buffer, ct);
                    if (result.MessageType == WebSocketMessageType.Close) break;
                    message.Write(buffer, 0, result.Count);
                } while (!result.EndOfMessage && message.Length < 256 * 1024);
                if (result.MessageType == WebSocketMessageType.Close) break;
                if (result.MessageType == WebSocketMessageType.Text) await Relay(room, me, message.ToArray());
            }
        }
        catch (Exception e) when (e is WebSocketException or OperationCanceledException)
        {
            // the connection dropped; treat it like a close
        }
        finally
        {
            if (!me.Replaced && room.TryGetValue(userId, out var current) && ReferenceEquals(current, me))
            {
                room.TryRemove(userId, out _);
                await Broadcast(inspectionId, userId, new { type = "peer-left", userId });
            }
            await CloseQuietly(socket, WebSocketCloseStatus.NormalClosure, "bye");
        }
    }

    private static async Task Relay(ConcurrentDictionary<Guid, Peer> room, Peer from, byte[] bytes)
    {
        try
        {
            using var doc = JsonDocument.Parse(bytes);
            var root = doc.RootElement;
            if (root.GetProperty("type").GetString() != "signal") return;
            if (!Guid.TryParse(root.GetProperty("to").GetString(), out var to) || !room.TryGetValue(to, out var target)) return;
            await target.SendAsync(new { type = "signal", from = from.UserId, data = root.GetProperty("data").Clone() });
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException)
        {
            // malformed messages are ignored
        }
    }

    private async Task Broadcast(Guid inspectionId, Guid? except, object message)
    {
        if (!_rooms.TryGetValue(inspectionId, out var room)) return;
        foreach (var peer in room.Values.Where(p => p.UserId != except)) await peer.SendAsync(message);
    }

    private static async Task CloseQuietly(WebSocket socket, WebSocketCloseStatus status, string reason)
    {
        try
        {
            if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived)
                await socket.CloseOutputAsync(status, reason, CancellationToken.None);
        }
        catch (WebSocketException)
        {
            // already gone
        }
    }
}

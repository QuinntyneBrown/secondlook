namespace SecondLook.Application.Abstractions;

/// <summary>Who is on a call right now, and pushing events to them (ADR 0012). Implemented by the signalling hub.</summary>
public interface ICallChannel
{
    IReadOnlyCollection<Guid> PresentUsers(Guid inspectionId);

    /// <summary>Tells everyone on the call that something changed, so they read the call again.</summary>
    Task NotifyChangedAsync(Guid inspectionId, CancellationToken ct);

    /// <summary>Tells everyone the call ended and closes their connections.</summary>
    Task EndAsync(Guid inspectionId, CancellationToken ct);
}

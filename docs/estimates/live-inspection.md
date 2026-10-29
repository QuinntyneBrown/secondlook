# Estimates: live-inspection

| Design | Effort | Complete |
|---|---|---|
| check-camera-and-mic | 3 days | 80% |
| end-call | 3 days | 70% |
| in-call-banners | 2 days | 30% |
| join-live-inspection | 8 days | 75% |
| recover-from-connection-loss | 3 days | 85% |

## Evidence after J10

- **join-live-inspection (75%)**: delivered and tested: call sessions, signalling socket, peer-to-peer media between two real browser sessions on synthetic devices, authorization (404 for outsiders, 401 anonymous), checklist and notes for the mechanic only. Remaining: STUN/TURN for calls across NATs, a signalling backplane for more than one API instance, the seller joining from a text link, the body shop joining a combined call (exercised in J12).
- **check-camera-and-mic (80%)**: delivered: device preview and choice, blocked-camera guidance with audio-only join, who is here, not-yet-open state, not-found state. Remaining: the recording notice and the seller's and body shop's "joins at" statuses.
- **recover-from-connection-loss (85%)**: delivered: reconnecting state with automatic retries for about six seconds, "Disconnected" with one-click rejoin, media rebuilt on rejoin. Remaining: the weak-connection banner.
- **end-call (70%)**: delivered: confirmation with focus on "Stay on the call", end for everyone, idempotent, summary with length and checked and not-checked items. Remaining: the report promise, "Add another car" on the summary, the "couldn’t see" reasons, inspection status change (J11, J13).
- **in-call-banners (30%)**: delivered: the "joined" banner. Remaining: the recording, weak-connection and "text him again" banners.

Tests: 16 API integration tests in `CallTests` and 8 Chromium acceptance tests in `e2e/tests/call/call.spec.ts` (two browser sessions, synthetic camera and microphone, real signalling).

# Estimates

- Overall effort: 47 days (platform and live inspection; other subsystems not yet estimated)
- Complete: 57% (about 27 of 47 days, after J10)

| Subsystem | Effort | Complete |
|---|---|---|
| [platform](platform.md) | 28 days | 46% |
| [live-inspection](live-inspection.md) | 19 days | 72% |

Evidence: J00 delivered the platform foundation with API integration tests, CLI tests, scoping tests, frontend unit tests and a Chromium smoke suite; see [platform](platform.md) for per-design evidence. J10 delivered the live video inspection (lobby, two-party WebRTC call, recovery, end call) with API integration tests and Chromium acceptance tests; see [live-inspection](live-inspection.md). The platform figures have not been re-assessed since J00, and the booking, payment and account subsystems are not yet estimated.

## Roadmap

1. platform: initial-setup-and-platform (J00 gate: configuration, CLI, auth, errors, health, shells, E2E, CI)
2. platform: scoping, forbidden pages and system pages on top of the foundation
3. platform: dialog behaviour

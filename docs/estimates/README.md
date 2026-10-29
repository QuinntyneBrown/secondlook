# Estimates

- Overall effort: 79 days (platform, live inspection, reports, marketplace operations and the inspections designs touched so far; other designs not yet estimated)
- Complete: 67% (about 53 of 79 days, after J14)

| Subsystem | Effort | Complete |
|---|---|---|
| [platform](platform.md) | 28 days | 46% |
| [live-inspection](live-inspection.md) | 19 days | 72% |
| [reports](reports.md) | 21 days | 80% |
| [marketplace-ops](marketplace-ops.md) | 3 days | 80% |
| [inspections](inspections.md) | 8 days | 85% |

Evidence: J00 delivered the platform foundation with API integration tests, CLI tests, scoping tests, frontend unit tests and a Chromium smoke suite; see [platform](platform.md) for per-design evidence. J10 delivered the live video inspection (lobby, two-party WebRTC call, recovery, end call) with API integration tests and Chromium acceptance tests; see [live-inspection](live-inspection.md). J11 delivered the estimate report (mechanic's editor, buyer's report, sharing, PDF copy, issue reports); see [reports](reports.md). J12 delivered the body shop's side of a review (queue, call, findings, buyer's report); see [marketplace-ops](marketplace-ops.md). J13 delivered comparing a buyer’s cars; see [reports](reports.md). The platform figures have not been re-assessed since J00, and the booking, payment and account subsystems are not yet estimated.

## Roadmap

1. platform: initial-setup-and-platform (J00 gate: configuration, CLI, auth, errors, health, shells, E2E, CI)
2. platform: scoping, forbidden pages and system pages on top of the foundation
3. platform: dialog behaviour

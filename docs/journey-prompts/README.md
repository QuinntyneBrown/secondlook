# Journey implementation prompts

Run one prompt at a time from the repository root. Each prompt is self-contained: it implements its journey, records a narrated demo of the running implementation, creates a PR and verifies its merge to remote `main`. This directory contains instructions, not completed implementations or newly recorded videos.

J00 must complete and merge before any product journey starts. The order below is a valid dependency order; explicit dependencies remain binding if a different order is chosen. Sign-in follows the platform's token validation foundations. Payment establishes a durable checkout contract before booking integrates reservation and confirmation, avoiding a payment/booking dependency cycle.

The user's instruction to save prompts in the repository overrides the writing-feature-prompts skill's default temporary location.

| ID | Journey prompt | Prerequisites | Planned implementation demo |
| --- | --- | --- | --- |
| J00 | [Initial setup and platform](00-initial-setup-and-platform-prompt.md) | None | `docs/videos/journeys/00-initial-setup-and-platform/demo.mp4` |
| J01 | [Sign up and sign in](01-sign-up-and-sign-in-prompt.md) | J00 | `docs/videos/journeys/01-sign-up-and-sign-in/demo.mp4` |
| J02 | [Administer mechanics and shops](02-administer-mechanics-and-shops-prompt.md) | J00, J01 | `docs/videos/journeys/02-administer-mechanics-and-shops/demo.mp4` |
| J03 | [Manage availability](03-manage-availability-prompt.md) | J00, J01, J02 | `docs/videos/journeys/03-manage-availability/demo.mp4` |
| J04 | [Manage vehicles](04-manage-vehicles-prompt.md) | J00, J01 | `docs/videos/journeys/04-manage-vehicles/demo.mp4` |
| J05 | [Pay for inspection](05-pay-for-inspection-prompt.md) | J00, J01 | `docs/videos/journeys/05-pay-for-inspection/demo.mp4` |
| J06 | [Book a video inspection](06-book-a-video-inspection-prompt.md) | J00, J01, J02, J03, J04, J05 | `docs/videos/journeys/06-book-a-video-inspection/demo.mp4` |
| J07 | [Reschedule or cancel booking](07-reschedule-or-cancel-booking-prompt.md) | J00, J06 | `docs/videos/journeys/07-reschedule-or-cancel-booking/demo.mp4` |
| J08 | [Add additional vehicle](08-add-additional-vehicle-prompt.md) | J00, J05, J06 | `docs/videos/journeys/08-add-additional-vehicle/demo.mp4` |
| J09 | [Add body shop review](09-add-body-shop-review-prompt.md) | J00, J02, J03, J05, J06 | `docs/videos/journeys/09-add-body-shop-review/demo.mp4` |
| J10 | [Join live video inspection](10-join-live-video-inspection-prompt.md) | J00, J06 | [`docs/videos/journeys/10-join-live-video-inspection/demo.mp4`](../videos/journeys/10-join-live-video-inspection/demo.mp4) |
| J11 | [Receive safety certification estimate](11-receive-safety-certification-estimate-prompt.md) | J00, J10 | [`docs/videos/journeys/11-receive-safety-certification-estimate/demo.mp4`](../videos/journeys/11-receive-safety-certification-estimate/demo.mp4) |
| J12 | [Conduct body shop review](12-conduct-body-shop-review-prompt.md) | J00, J09, J10, J11 | [`docs/videos/journeys/12-conduct-body-shop-review/demo.mp4`](../videos/journeys/12-conduct-body-shop-review/demo.mp4) |
| J13 | [Compare vehicle estimates](13-compare-vehicle-estimates-prompt.md) | J00, J08, J11 | [`docs/videos/journeys/13-compare-vehicle-estimates/demo.mp4`](../videos/journeys/13-compare-vehicle-estimates/demo.mp4) |
| J14 | [Review inspection history](14-review-inspection-history-prompt.md) | J00, J06, J11 | `docs/videos/journeys/14-review-inspection-history/demo.mp4` |

## Execution contract

Read and execute the selected prompt; do not execute all prompts implicitly. Verify prerequisites on fetched remote main. Preserve unrelated work. Future implementation runs are authorized to push a scoped branch, open the journey PR and merge it after required checks and approvals. This document does not bypass GitHub protection, create reviewer approval, grant missing credentials or authorize deployment/real purchases. An unresolved merge blocker must be reported honestly.

Each prompt requires actual merge evidence, not just PR creation or auto-merge being enabled. Recordings must demonstrate running implementation; existing mock walkthroughs remain design references. Video links in this table are planned paths and become available when the corresponding prompt is executed.

# User journeys

| Name | Description | Estimate |
| --- | --- | --- |
| Initial setup and platform | Mandatory prerequisite: reproducible local setup, persistence and seed commands, API/auth foundations, buyer/admin shells, shared components, SQLite/Chromium acceptance harness, CI and narrated-demo tooling. Must be implemented and merged to remote main before any product journey. | To be estimated during platform design |
| Book a video inspection | Buyer picks a vehicle, chooses a time, and books a mechanic. | 8 days |
| Join live video inspection | Buyer and mechanic connect over video while the mechanic inspects the vehicle. | 10 days |
| Receive safety certification estimate | Mechanic submits a repair cost estimate; buyer reviews it and decides. | 6 days |
| Pay for inspection | Buyer pays $50 for the first inspection, idempotently and securely. | 6 days |
| Add additional vehicle | Buyer adds another vehicle in the same window for $25. | 4 days |
| Compare vehicle estimates | Buyer views estimates for several vehicles side by side. | 3 days |
| Add body shop review | Buyer adds a body shop review, or both, for a small fee. | 5 days |
| Conduct body shop review | Body shop reviews the vehicle over video and submits findings. | 5 days |
| Sign up and sign in | Buyer, mechanic, or body shop creates an account and authenticates. | 5 days |
| Manage availability | Mechanic or body shop sets the times they can take inspections. | 4 days |
| Reschedule or cancel booking | Buyer changes or cancels an upcoming inspection. | 3 days |
| Manage vehicles | Buyer adds, edits, and removes their saved vehicles. | 3 days |
| Review inspection history | Buyer revisits past inspections and their estimates. | 2 days |
| Administer mechanics and shops | Admin onboards, approves, and deactivates mechanics and body shops. | 5 days |

## Implementation order and delivery

Start with **J00: Initial setup and platform**. No product journey begins until its platform gate passes and its PR is merged to remote `main`. The original product estimates above are retained planning figures, not verified completion or new estimates.

[Journey prompt index](journey-prompts/README.md) provides one ready-to-run implementation prompt for all 15 journeys, dependencies and planned demo destinations. Each run must implement its journey using the repository’s artifact-first ATDD process, record a narrated demo of the running implementation, create a PR, pass checks and required reviews, and verify merge to remote GitHub `main`.

Existing videos under `docs/videos/01-*`, `02-*` and `03-*` demonstrate static mocks. New implementation demos belong under `docs/videos/journeys/` and are produced by executing the corresponding prompt.

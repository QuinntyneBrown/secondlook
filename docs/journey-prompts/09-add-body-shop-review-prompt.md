# J09: Add body shop review

## Goal

Buyer chooses mechanic review, body shop review or both where allowed by the requirements. Show and charge the configured extra fee, persist selected services and assign an eligible shop. Determine missing fee and combined scheduling rules explicitly before implementation; do not silently invent prices.

## Dependencies and repository context

J00 — Initial setup and platform, J02 — Administer mechanics and shops, J03 — Manage availability, J05 — Pay for inspection, J06 — Book a video inspection. Each must be implemented and merged to origin/main first. Verify their behavior and merge evidence before starting; do not silently implement prerequisite journeys inside this PR.

- Journey source: `docs/user-journeys.md`.
- Requirements to inspect/reuse: L2-024–029, L2-062.
- Existing detailed-design areas under `docs/detailed-designs/`: booking-pricing/choose-review-type, booking-pricing/price-booking, booking-pricing/schedule-inspection.
- Mock screens under `docs/mocks/pages/` or new screens to add: book-review-type, book-schedule, checkout, inspection-detail.
- Backend: `backend/src/SecondLook.Domain`, `SecondLook.Application`, `SecondLook.Infrastructure`, `SecondLook.Api`, `SecondLook.Cli`; inspect `SecondLook.Worker` only if needed.
- Frontend: `frontend/projects/secondlook/src/app`, `frontend/projects/admin/src/app`, `frontend/projects/api`, `frontend/projects/components`.
- Acceptance workspace: `e2e/`; startup: `eng/Start-E2eApi.ps1`; CI: `.github/workflows/ci.yml`.
- Suggested branch: `journey/09-add-body-shop-review`.
- Demo destination: `docs/videos/journeys/09-add-body-shop-review/`.

## Suggested slices and demo scenes

1. Review selection and fee.
2. shop availability.
3. combined booking.
4. checkout persistence.
5. unavailable shop and retry.

## Finish the whole feature in one run (CRITICAL)

You are authorized to complete this journey, its documentation, narrated demo, green checks, GitHub PR and merge to remote `main`. Continue through all phases without asking for routine approval. Keep a progress checklist across context summaries. Fix failures at their cause; never weaken tests or silently omit steps. Finish independent work if credentials, an unavailable service or a required human review blocks progress; report the exact blocker and never claim completion. This authorization does not cover production deployment, real purchases or external email sends.

## Binding project rules

Read `AGENTS.md`, nested instructions, `README.md`, relevant `docs/adr/` records and current source before changing anything. Preserve unrelated working-tree changes; use an isolated branch/worktree where necessary. Use .NET 10 and the repository-selected SDK, Node 22.12+ in the 22 line, Angular 21 and PowerShell 7. Maintain Domain → Application → Infrastructure/API dependency rules, handlers for business logic, explicit CLI migrations, idempotent seeds/bookings/payments, default API authentication and intentional anonymous endpoints. Request logging stays outside exception handling. Local JWTs and buyer ownership/assigned-provider access apply throughout.

Use the shared Angular components, role-based Fluent v9 tokens, BEM mock parity and API injection tokens. Keep styles encapsulated. Declare projected slots once. Use CDK Dialog/Overlay and no inline editing forms. Follow Storybook folder conventions and add perf scenarios for new components. Read relevant bottom-nav and visual-policy ADRs if present. Do not treat references to absent ADRs or legacy scripts as proof they work.

Production behavior needs a requirement, detailed design and mock before implementation. Invoke `.agents/skills/implementing-incrementally/SKILL.md` (and read the `.claude` equivalent when applicable) before writing production code. Use API integration acceptance tests and Chromium-only Playwright with page objects owning every selector and interaction. API/Infrastructure tests use per-fixture in-memory SQLite, Application/CLI use EF InMemory; API tests remain sequential. SQL Server-only tests use the existing opt-in attribute/category. E2E uses `eng/Start-E2eApi.ps1`, SQLite and synthetic fixtures, never LocalDB. Never add architecture, naming, banned-API or spec-parsing tests. Do not test static mocks/design-system artifacts.

## Phases 1–5: Align design artifacts before code

1. Invoke `agent-toolkit:writing-html-mocks`. Update the listed screens and dialogs in `docs/mocks/`, including loading, empty, invalid, busy, success, failed/retry, forbidden and no-results where applicable. Include phone/tablet/desktop, light/dark and accessible keyboard behavior. Update `docs/mocks/manifest.json`, gallery and coverage documentation. For CLI/API-only slices, document the observable flow and reuse system-state mocks rather than invent a product screen.
2. Invoke `extracting-design-systems`. Reuse/update `docs/design-system/` and shared components as needed; invoke `agent-toolkit:writing-screen-composition` for `docs/screen-composition.md`. Do not rebuild unrelated design documentation.
3. Invoke `engineering-requirements`. Read `docs/specs/L1.md` and `L2.md`, reuse the referenced IDs and add missing Given/When/Then criteria for this scope. The baseline maximum is L2-065; rescan at execution and allocate after the actual maximum to avoid collisions. Preserve existing IDs. Cover validation, concurrency, ownership/roles, recovery and responsive/accessibility behavior.
4. Invoke `writing-software-design-documents`. Read/update the listed existing detailed designs; add a focused design only where coverage is absent. Include API contracts, state transitions, persistence, security, integration boundaries and rendered diagrams in house style. Record material decisions in ADRs. Requirements, design and mocks must agree before code.
5. Invoke `estimating-designs`. Create/update `docs/estimates/README.md` and subsystem estimates. Assess existing implementation honestly; record remaining effort and evidence-based completion, then refresh after delivery.

## Phase 6: Implement thin slices with ATDD

Use the suggested scenes below as a starting point for small vertical slices. For each: finalize Given/When/Then criteria; write the acceptance test with requirement trace comments; run it and record the expected behavioral failure BEFORE production changes; implement only that slice; refactor green; run relevant regressions; commit only scoped files. Do not advance until the slice checks pass. Reuse working behavior rather than replacing it. Test success, failure and unauthorized cases. Seeded prerequisites may support isolated tests but must not substitute for a dependency journey’s implementation.

Run applicable checks from the actual manifests: `dotnet build backend/SecondLook.sln`, `dotnet test backend/SecondLook.sln`; in `frontend/`, `npm run lint`, `npm run format:check`, `npm run tokens:check`, `npm run build`, `npm run build:admin`, and `npm test -- --watch=false`; in `e2e/`, `npm run typecheck` and relevant behavior/visual tests using Chromium projects only. Run `npm run tokens` after source theme changes and `npm run build-storybook` after component API changes. Add new-component perf scenarios. Run required CI gates; correct stale scaffold configuration when it blocks this journey. Update visual baselines only for reviewed intentional design changes. Record exact commands and results in the PR.

## Phase 7: Record the implemented journey with narration

Invoke `agent-toolkit:recording-demo-videos`, scoped to this journey rather than every application. Use the existing `.agents/skills/creating-videos/SKILL.md` for the repository's narrated 1080p MP4 packaging, transcript and timing conventions. Record the real locally running application, API or CLI, using deterministic synthetic users/data and the actual persistence/authentication. Existing `docs/videos/01-booking-an-inspection`, `02-the-live-inspection` and `03-your-safety-estimate` are mock-based design walkthroughs; preserve them and label the new implementation demo distinctly. Do not film the static mock server or fake product API responses as implementation evidence.

Create a storyboard, readable transcript, audible edge-tts narration, captions, poster, chapter/timing data and rerun commands in the journey-specific destination below. Deliver `demo.mp4` at 1920x1080 with H.264 video and audio, plus the capture source/recording format required by the recording skill. Include `script.md`, `README.md`, recording source and any required slides. Show the happy path and at least one meaningful validation/recovery/access-control case. Disclose local mail/payment adapters; do not make real charges or send external mail. For platform setup, record actual local setup and behavioral smoke commands with secrets redacted.

Verify media streams and duration with ffprobe, inspect representative frames and listen to narration for synchronization/clarity. Replay the demo from a clean disposable fixture using documented commands. Finite timeouts and cleanup must stop only owned processes/resources; background helpers on Windows are hidden. Respect `.gitattributes`/Git LFS for large media and confirm committed media are downloadable, not only local files or expired CI artifacts. Keep caches, tokens and private data out of git. Register the new demo in `docs/videos/README.md` and link it from the journey/prompt index.

## Phase 8: Create the PR and verify merge to remote main

Use the GitHub connector if available and sufficient, otherwise authenticated `gh` and git. Verify `origin` is `https://github.com/QuinntyneBrown/secondlook.git` and the target is `main`. Fetch `origin/main`, create/use the scoped feature branch, and commit the implementation, tests, design updates and verified demo. Never include unrelated dirty/untracked work. Before publishing, fetch again, rebase onto current `origin/main`, resolve conflicts without discarding others' changes, and rerun affected checks. Never force-push `main`; if rebasing your own published branch requires it, use force-with-lease.

Push the branch and open a PR targeting `main`. Include user-visible behavior, requirement IDs, red/green ATDD evidence, validation commands/results, video links, material decisions and deferred scope. With gh, write multiline PR text to a file and pass `--body-file`. Monitor checks and review state; fix failures and substantive feedback, push corrections and rerun checks. Merge using a repository-permitted method when all required checks and approvals pass. Do not bypass branch protection or approvals, self-approve, disable CI or use administrator overrides. An auto-merge request is not completion: wait for the actual merge. Missing credentials/permissions or required human approval is an explicit blocker.

After merge, fetch `origin/main`; query GitHub for PR `MERGED` state and merge commit, then verify that commit is an ancestor of `origin/main` (`git merge-base --is-ancestor`). Confirm the final pushed commit was checked, the merged files include the implementation and playable demo, and report the PR URL and merge SHA. Do not claim that making a local commit or opening a PR completes this prompt.

## Done means

- This journey works end to end, including its stated failure/security cases, with aligned requirements, mocks, detailed designs and estimates.
- ATDD red-before-code evidence and green regressions exist; all required remote checks passed for the final reviewed changes.
- The narrated implementation demo, captions, source and reproducible run instructions are saved in the repository and verified.
- GitHub confirms the PR merged to `main`; its merge commit is present on fetched `origin/main`.
- End with a concise summary, demo path, test evidence, PR URL, merge SHA and any deferred items. If genuinely blocked, state what is complete and what prevents completion without claiming success.

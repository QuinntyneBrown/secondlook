# ADR 0014: The body shop's review is its own part of the report

## Status
Accepted (J12)

## Context
`L2-062` says an assigned body shop reviews the vehicle over video and that the buyer can read its findings in the report. ADR 0013 made the report the mechanic's estimate. A review can be with the mechanic, with the body shop, or with both, and the body shop's findings must not be confused with, or change, the safety certification estimate.

## Decision
- **One report per inspection, two parts.** `Report` carries the mechanic's part (`MechanicId`, `MechanicSubmittedAt`) and the body shop's part (`BodyShopId`, `BodyShopSubmittedAt`). It exists from the first part submitted. Each finding has a `Source` (Mechanic or BodyShop), so authorship is kept on every finding. Submitting a part replaces only that part's findings, and one part never waits for the other.
- **Separate completion.** The body shop part is `NotRequested` (no body shop assigned), `InProgress` (assigned, nothing submitted) or `Ready` (submitted). The mechanic part is `MechanicReady` or not. A buyer with a "Both" review can read whichever part is delivered first.
- **Totals stay the mechanic's.** The certification cost and the all-in total are computed from the mechanic's Required findings only. The body shop's costs are listed with its findings and never added in, because "body repairs are separate from the safety certification estimate".
- **A review with the body shop alone** (`ReviewType` BodyShop, booked in J09) has no mechanic: the report shows only the body shop's findings, with no certification estimate or "Is it worth it?" total, and says "reviewed by" the shop.
- **Same call.** The assigned body shop joins the same live call as the buyer and the mechanic (ADR 0012's hub already admits up to three). It runs no checklist; only the mechanic does. In a review with the shop alone the call has no checklist controls.
- **Writing:** `PUT /api/inspections/{id}/report/body-shop`, by the assigned body shop only, after the call has ended (409 before), with the same finding rules and limits as the estimate (shared validation). The mechanic's endpoint refuses the body shop (403) and the body shop's endpoint refuses the mechanic and the buyer (403); an inspection that is not assigned to the caller is 404.
- **The queue:** `GET /api/reviews/assigned` (BodyShop role only) lists the shop's own scheduled inspections, soonest first, with the call status (NotStarted, Live, Ended) and whether the review is delivered. Other roles get 403, anonymous 401, and nobody sees another shop's inspections.
- **Sharing** carries the body shop's part only if the buyer includes it (ADR 0013): otherwise the shared report shows it as not shared.
- **Migration:** `SubmittedAt` is renamed to `MechanicSubmittedAt` and made nullable, so existing estimates keep their time.

## Not in J12 (deferred and disclosed)
Recording and body shop screenshots, notifying the buyer that the body review is ready (J14), a body shop reply to an issue, a separate body-shop-only checklist for the call, and the shop adjusting a delivered review after the buyer questions it beyond resubmitting it.

## Consequences
The report can grow a part without touching the other, each finding says who wrote it, and a body-shop-only review is a first-class case instead of an empty estimate.

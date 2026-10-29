# ADR 0016: The buyer's inspection history

## Status
Accepted (J14)

## Context
`L2-019` to `L2-022` describe the dashboard as the buyer's list of inspections: Active and Past tabs, a status for each row, estimates, twenty to a page, and loading, empty and error states. The inspection history design leaves the rule that makes an inspection "past", the columns of a past row, the order, the page size, the copy of an empty Past tab and the display of a cancelled inspection as `<TO SUPPLY>`.

## Decision
- **One read endpoint, computed on read.** `GET /api/inspections/history?tab=Active|Past&page=N` (Buyer role only) returns one page of the buyer's inspections plus the counts of both tabs. Nothing new is stored, so no migration is needed. An unknown tab is a 400; a page that is missing, below 1 or not a number is the first page; a page past the end is empty.
- **Active and Past.** An inspection is **Past** when it is cancelled, or when its review is delivered: the mechanic's estimate for a mechanic review, the body shop's findings for a body shop review, and both for a combined review (ADR 0014). Everything else is **Active**: scheduled, live, or the call is done and the report is still being written. A delivered report therefore leaves the Active tab for the Past tab at once.
- **Order and size.** Active is soonest call first; Past is newest first. A page is 20 rows (the server's constant, returned as `pageSize`).
- **Row content.** Each row carries the VIN, the review type, the providers' names, the asking price, the call time, a **phase** (Upcoming, Live, CallEnded, ReportReady, Cancelled) and, once delivered, an **estimate summary**: "Required" with the number of required repairs and the cost range summed from the mechanic's Required findings, else "Recommended", else "Passes". For a review with the body shop alone the summary comes from the body shop's findings. A cancelled row has no summary but keeps the vehicle, price, providers, cancellation time and refund it was booked with (ADR 0009), so history never changes retroactively.
- **Where a row goes.** A row whose report is ready opens the report; every other row (including cancelled ones) opens the inspection, whose cancelled view shows the refund (J07).
- **Navigation state is in the address.** The tab and page are query parameters (`?tab=past&page=2`), so going back from a report returns to the same tab and page.
- **States.** Loading is busy with placeholder rows ("Loading your inspections"); no inspections at all shows the welcome with "Book an inspection" and "View sample report" (a fixed example report at `/sample-report`, clearly marked as made up); a failed load shows "Your inspections didn’t load" with "Try again" and a support link; an empty tab says what it holds.

## Deviations from the written design (disclosed)
- The mock listed a "Report ready" row under Active and counted it ("3 active"). Delivered inspections are Past here, as the journey's "completed and cancelled records" implies, so the Active count excludes them and "Report ready" appears in Past rows.
- The mock's rows show make, model and location; the booking does not capture them, so a row shows the VIN.
- Retention of past inspections is not limited: they stay in the account.

## Consequences
A buyer finds a finished inspection and its estimate in one click and can page through a long history without the page growing. The history is always consistent with the reports, because it is read from them.

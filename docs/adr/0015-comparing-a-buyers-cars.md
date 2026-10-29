# ADR 0015: Comparing a buyer's cars

## Status
Accepted (J13)

## Context
`L1-011` and `L2-051`, `L2-052` describe "Compare cars": the vehicles a buyer had inspected in the same pricing window, side by side, lowest all-in cost first. The design leaves the endpoint, the ordering tie-break, which window applies and what a car without a report looks like as `<TO SUPPLY>`.

## Decision
- **Computed on read, no new tables.** `GET /api/comparisons` (Buyer role only) builds the comparison from the buyer's own scheduled inspections, their pricing window and their reports. Nothing is stored, so a column can never disagree with its report.
- **Which cars:** the buyer's scheduled (not cancelled) inspections booked inside their **latest** pricing window (`CreatedAt` from the window's start up to its end). A buyer with no window has no comparison. Another buyer's cars are never read: the query is scoped to the caller (L2-057).
- **Which total:** a car's all-in range is its asking price plus the certification cost range from the mechanic's Required findings, exactly as its report computes it (ADR 0013, 0014). Body shop costs are not part of it.
- **Statuses:** `Ready` (the mechanic's estimate is in), `Pending` (it is not written yet, including a call that has not happened) and `NoEstimate` (a review with the body shop alone has no certification estimate). Only Ready cars have costs.
- **Order:** Ready cars first, by lowest all-in (lower bound, then upper bound, then call time); then the others by call time.
- **Lowest all-in:** marked only when two or more cars can be compared, and every car tied with the cheapest on both bounds is marked.
- **Two cars are needed to compare.** The page shows "Compare needs two cars" for one car (or none), and the columns for two or more, including pending ones, so a buyer can see a car is on its way. The API returns whatever cars there are and leaves that decision to the page.
- **Adding a car** reuses the J08 dialog and window lookup; the price shown is the additional-vehicle price while the window is open and a new inspection's price after it has closed.
- **Layout:** the cars sit in a responsive grid that stacks to one column on a phone, and the page never scrolls sideways.

## Not in J13 (deferred and disclosed)
The car's location and its make and model, which the booking does not capture (a car is shown by its VIN and kilometres); comparing across more than one window; a "Compare" notification; and removing a car from the comparison.

## Consequences
The comparison is always consistent with the reports and needs no migration. A buyer sees pending cars rather than silently losing them, and a body-shop-only review is not forced into a cost it does not have.

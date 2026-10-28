# ADR 0010: Pricing window duration, boundaries and the additional-vehicle price

## Status
Accepted (J08)

## Context
`L2-027` fixes the prices ($50 first, $25 additional, +$20 for both reviews) and says a window lasts fourteen days from the first booking. `L2-033` and `L2-034` add the "Add another car" dialog and the window banner, which speak of "two days remain" and "has closed". The mocks assume a 14-day window and flag it as an assumption (`docs/mocks/README.md`). J08 must not invent a silent window, so the rules are recorded here.

## Decision
- **Duration:** 14 days (336 hours) from the instant the buyer's first payment succeeds. This is the product assumption already stated in the mocks and `L2-027`; it is configurable in one place (`PriceCalculator.WindowLength`) and changing it needs a new decision.
- **Start:** the instant of the first successful payment in no open window. The booking that follows is confirmed immediately after (J06), so "first booking" and "first payment" are the same moment for the buyer.
- **Boundary:** a window is open from its start up to, but **not including**, its end. At the exact end instant it is closed. A payment one tick before the end is an additional vehicle ($25); a payment at the end instant is a new first inspection ($50) and starts a new window.
- **Closing soon:** when two days or less remain (inclusive) the window is `ClosingSoon`; the banner then reads "Your window closes in 2 days" and is dismissible.
- **Closed:** after the end, the buyer's most recent window is `Closed` and the banner "Your window has closed" is shown until they book again. A buyer who has never paid has state `None`.
- **Cancelling or refunding a car never changes the window**: it stays open for the same dates; cars that were refunded no longer count toward "cars in your window".
- **Server decides eligibility:** `GET /api/pricing-window` returns the state, `endsAt`, `daysRemaining`, `carsInWindow` and the two prices; the quote at checkout comes from the same rule (J05). The client never computes eligibility or price.
- **Preference "Tell me when my window is closing"** (`L2-034` AC4) belongs to the notification-preferences feature and is not built here.

## Consequences
The window banner, the dialog note and the checkout price can never disagree, because they read the same server state. A longer or shorter window, or per-vehicle windows, would be a later decision.

# ADR 0011: Body shop review, combined calls and shop assignment

## Status
Accepted (J09)

## Context
`L2-024` offers Mechanic, Body shop and Both (+$20), and `L2-027` already fixes the fee: a mechanic review is $50 (or $25 as an additional vehicle) and choosing both adds $20. The designs do not say how a body shop is scheduled or assigned, or how a combined call works. J09 must decide this explicitly rather than invent prices.

## Decision
- **Prices are unchanged and come only from `PriceCalculator`** (J05): Mechanic $50 or $25, Body shop alone the same as a mechanic review (the assumption recorded in the mock README), Both adds $20. No new fee is introduced.
- **One call per inspection.** A *combined call* (Both) is a single video call with the mechanic and the body shop reviewer present, so it needs a start time at which an approved mechanic and an approved body shop are both free.
- **Body shop alone:** the call is with one approved body shop; the inspection is assigned to that shop (`BodyShopId`, no mechanic).
- **Eligibility:** only approved, active providers (`CanTakeInspections`, J02) of the right kind are offered. When several are free at the same start time, the one whose display name sorts first is offered, so the answer is stable.
- **Slots:** `GET /api/slots?kind=Mechanic|BodyShop|Both`. For `Both`, a slot is offered only when a mechanic and a body shop are free at that start; the slot names both.
- **Hold:** `POST /api/bookings/holds` takes an optional `bodyShopId`. When given, the mechanic slot and the body shop slot are both held for 10 minutes, all or nothing: if the second cannot be taken, the first is released and the answer is 409 "We couldn’t hold that slot". A body-shop-only booking holds the shop's slot alone.
- **Confirm:** `POST /api/bookings` takes an optional `bodyShopHoldId`. The review of the paid checkout must match the holds: Mechanic needs a mechanic hold only, Body shop a shop hold only, Both a mechanic hold and a shop hold; anything else is 409. The inspection records `MechanicId`, `BodyShopId` and both reservations, so each provider sees it (L2-058).
- **If the shop slot is lost after paying** (the hold expired and someone else took it), the same recovery as J06 applies: the booking is refused and the payment is refunded in full.
- **Cancel and reschedule act on every reservation of the inspection:** cancelling releases both slots; rescheduling needs the same mechanic and the same body shop to be free at the new time and moves both.
- **Unavailable shop:** when no start has both a mechanic and a body shop free, the schedule step says so and the buyer can go back and choose a single review; nothing is charged until they pay.

## Consequences
Combined calls reduce the choice of times to those two providers share. Matching a different shop to a time that suits the mechanic is possible because any approved shop that is free qualifies; preferences or ratings are later work.

# ADR 0009: Rescheduling and cancelling an inspection

## Status
Accepted (J07)

## Context
A buyer can move or cancel an upcoming inspection. Availability must stay consistent (no double-booked or orphaned slots), only the owner may act, and repeating a cancellation must never refund twice.

## Decision
- **Only a `Scheduled` inspection whose call has not started** can be rescheduled or cancelled; otherwise 409.
- **Reschedule keeps the same mechanic** ("Dev Patel is free at these times"). `GET /api/inspections/{id}/reschedule-slots` lists that mechanic's free slots; `POST /api/inspections/{id}/reschedule {start}` books the new slot first (the unique reservation index decides races), then moves the inspection with a conditional update (`Scheduled` and still on the old reservation) and releases the old slot. If the new slot is taken, not offered, or the inspection moved meanwhile, the answer is 409 "We couldn’t move the call", the original time stays booked and any slot taken for the attempt is released.
- **Undo** a reschedule is a reschedule back to the original time; it succeeds while that slot is still free.
- **Cancel** needs one of four reasons (`DifferentCar`, `SellerBackedOut`, `PriceChanged`, `Other`). The inspection is marked `Cancelled` with a conditional update (`Scheduled` to `Cancelled`) so only one request wins; the winner releases the slot (it returns to the list) and refunds through the J05 `RefundPaymentCommand` with reason `BuyerCancelled` and the hours before the call: more than 2 hours is a full refund, under 2 hours keeps a $25 fee. A repeated or concurrent cancel returns the cancelled inspection and refunds nothing more.
- The inspection shows `refundPreviewCents` (what cancelling now would refund) and `cardLast4`, and, once cancelled, `cancelledAt`, `refundedCents` and `retainedCents`. Cancelled inspections leave the Active list and appear under Past.
- Notifying the seller by text is a local adapter concern and is not built here: the screens say the seller is told, but no message is sent (the same local-adapter stance as email).

## Consequences
The slot and the refund each change exactly once per cancellation, whatever the retry pattern. A later "report issue" or provider-side cancellation can reuse the same release-and-refund path.

# ADR 0008: Booking is hold, pay, confirm

## Status
Accepted (J06)

## Context
A booking joins three things built earlier: a saved vehicle (J04), a slot (J03) and a payment (J05). The buyer must end with exactly one confirmed inspection, never two charges, and a clear recovery when a slot is lost or a payment fails.

## Decision
- **Three steps, each idempotent:** (1) *hold* a slot for 10 minutes, (2) *pay* the checkout through the J05 flow, (3) *confirm* the booking with the paid checkout, the hold and the vehicle. The buyer sees "Vehicle, Review, Schedule, Pay" and then the confirmation.
- **Hold:** `POST /api/bookings/holds` takes a slot with `ReserveSlotCommand` as a `Held` reservation owned by the buyer. A buyer has one active hold: taking a new one releases the old. A slot someone else holds, books, or that is not offered is a 409 "We couldn’t hold that slot". An expired hold stops blocking.
- **Confirm:** `POST /api/bookings` requires a paid checkout, a hold and a saved vehicle that all belong to the buyer, and creates the `Inspection` with the reservation turned into `Booked` in one save. Exactly one inspection exists per checkout (unique index); repeating the request, or sending several at once, returns the same inspection.
- **The inspection owns a copy of the vehicle details** (VIN, odometer, asking price, listing link, seller name and phone) taken at confirmation. Later edits or removal of the saved vehicle never change it (ADR 0006).
- **Hold expired after paying:** if the buyer's expired hold row still exists and nobody else took the slot, confirmation re-books it. If someone else took it, the booking is refused with 409 "We couldn’t hold that slot" and the payment is **refunded in full automatically** (`RefundReason.SlotUnavailable`), so the buyer is never charged for nothing and is not asked to pay twice.
- **Payment failure** leaves the checkout `Pending` and the hold in place until it expires; the buyer retries with another card (J05).
- **Assignment:** the inspection is assigned to the mechanic whose slot it is. A body shop review is recorded in the review choice; matching a body shop belongs to J09 and J12, so `BodyShopId` stays empty here.
- **Visibility:** a buyer sees their own inspections, a mechanic or body shop only those assigned to them (L2-058); another user's inspection is 404.

## Consequences
The J05 pricing window still opens when the payment succeeds. A paid checkout whose confirmation never arrives (for example the browser closes) can be confirmed later within the hold, or is refunded at the next attempt; a background sweep for abandoned paid checkouts is later work.

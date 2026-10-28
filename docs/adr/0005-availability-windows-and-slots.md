# ADR 0005: Availability windows, slots, time zones and reservations

## Status
Accepted (J03)

## Context
`L2-061` lets approved providers save the times they can take inspections and lets buyers see only free times. The manage-availability and schedule-inspection designs leave the window format, overlap rules, time zone handling, slot length, concurrency and removal of booked slots open.

## Decision
- **Window:** a one-off `AvailabilityWindow` with `StartUtc` and `EndUtc`, stored in UTC and exchanged as ISO 8601 with an offset. Weekly patterns are out of scope. Windows must start in the future, end after they start, lie on 30-minute boundaries and be at most 12 hours long.
- **Time zone:** SecondLook serves Ontario, so the displayed zone is `America/Toronto`. The API never stores local times; the UI converts. Slots are returned in UTC with the zone name in the response.
- **Overlap:** one provider's windows may not overlap or touch-overlap; a window that overlaps another is a 409 conflict. Editing is `PUT` (replace start and end); removal is `DELETE`.
- **Slots:** a window divides into consecutive 30-minute slots from its start; a slot that would run past the end is dropped. A slot's identity is `(providerId, startUtc)`.
- **Who:** only an approved, active provider (`CanTakeInspections`) may save windows; pending and deactivated providers get 403. A provider can touch only its own windows; another provider's window is 404 (never revealed).
- **Slot visibility:** buyers see slots of providers who can take inspections, in the future, that have no active reservation. Held reservations count until they expire.
- **Reservations and concurrency:** `SlotReservation` (`ProviderId`, `StartUtc`, `Status` Held or Booked, `ExpiresAt` for holds) with a unique index on `(ProviderId, StartUtc)`. `ReserveSlotCommand` creates a reservation inside the provider's availability; if the slot is taken, including by a concurrent request that loses the unique-index race, the result is a conflict. The booking journeys (J05, J06) call it; J03 exposes no buyer endpoint to reserve.
- **Removing or shortening over a reservation:** a window cannot be removed, or edited so that it no longer covers a reserved slot, while an active reservation lies inside it (409, "That time is already booked"). The provider must have the booking handled first. Expired holds do not block.

## Consequences
Reserved slots are never silently lost. Weekly patterns and time-zone-aware recurrence are later work. Reservation cancellation and release belong to the booking journeys.

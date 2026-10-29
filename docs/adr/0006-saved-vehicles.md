# ADR 0006: Saved vehicles, validation, duplicates and history

## Status
Accepted (J04). Amended by ADR 0018: year, make and model are required and the VIN is optional.

## Context
`L2-063` lets a buyer add, edit and remove saved vehicles, `L2-057` says buyers see only their own data, and the manage-saved-vehicles design leaves the validation, duplicate handling, removal semantics and effect on past inspections open.

## Decision
- **Fields:** `Vin` (17 characters, letters and digits except I, O and Q, stored upper case), `OdometerKm` (whole number, 0 to 1,500,000), `AskingPrice` (0 to 1,000,000, two decimals), `ListingUrl` (optional, http or https), `SellerName` (required, up to 100 characters), `SellerPhone` (10 digits; spaces, dashes, dots, brackets and a leading 1 are accepted and stored as 10 digits). The VIN lookup ("Looks like a 2016 Honda Civic LX") belongs to the booking flow (J06).
- **Ownership:** every read and write is scoped to the caller through `ForBuyer`; another buyer's vehicle is 404, never 403. Only the role Buyer uses these endpoints.
- **Duplicates:** a buyer cannot save the same VIN twice while one is saved (409 "You already saved that vehicle"). Another buyer may save the same VIN.
- **Removal is soft:** `RemovedAt` is set and the vehicle drops out of the list; nothing is deleted. Removing an already removed vehicle is 404. Saving a removed VIN again creates a new record.
- **History:** an inspection, once booked, keeps its own copy of the vehicle details taken at booking time (J06 snapshots them). Editing or removing a saved vehicle therefore never changes a past inspection.
- **Idempotency:** adding is not retried silently; a repeated add of the same VIN returns the 409 above instead of a second record.

## Consequences
Removed vehicles accumulate as soft-deleted rows; account deletion (a later feature) must purge them. The booking journeys must copy vehicle details onto the inspection rather than reference the live vehicle.

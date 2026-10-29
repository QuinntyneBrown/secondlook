# ADR 0018: Year, make and model identify a vehicle; the VIN is optional

## Status
Accepted. Amends ADR 0006.

## Context
Buyers often see a listing before they know the VIN: the seller has not shared it, or the buyer is booking from a phone with only the ad in hand. ADR 0006 made the 17-character VIN required, and every screen named a car by its VIN, which also reads badly ("2HGFC2F59GH512345" means nothing to a buyer comparing cars). `L2-085` asks for the year, make and model to be required and the VIN to be optional.

## Decision
- **Fields:** `Vehicle` and the vehicle copy on `Inspection` gain `Year` (whole number, 1900 to next calendar year by the server clock), `Make` and `Model` (required, trimmed, up to 50 characters). `Vin` becomes nullable: empty or whitespace is stored as `null`; when given it keeps the ADR 0006 rules.
- **Duplicates:** the "You already saved that vehicle" check applies only when a VIN is given. Two saved vehicles without a VIN, even with the same year, make and model, are allowed: a buyer may be looking at two of the same car.
- **Name:** a vehicle is shown as "{Year} {Make} {Model}". Read models that only display a car (history, call, comparison, report, review queue) carry this as `vehicleName`; the saved vehicle and booking copy carry the three fields. `VehicleName.Of` in the domain builds it and falls back to the VIN when no make is recorded.
- **Existing rows:** the migration adds `Year` as 0 and `Make` and `Model` as empty strings. Those rows keep showing their VIN through the fallback above; editing a saved vehicle asks for the missing fields.
- **Add another car:** the dialog's VIN becomes optional and only pre-fills the vehicle step, where the year, make and model are asked.

## Consequences
The VIN lookup ("Looks like a 2016 Honda Civic LX") stays out of scope; when it lands it can pre-fill the three fields. The ordering of the Vehicles page and the comparison's tie-break use the name instead of the VIN.

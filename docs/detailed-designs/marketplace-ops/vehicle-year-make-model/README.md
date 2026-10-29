# Vehicle year, make and model; optional VIN

## Overview

This change makes a saved vehicle identified by its year, make and model, and makes the VIN optional (`L2-085`, ADR 0018). It amends the designs of [manage saved vehicles](../manage-saved-vehicles/README.md), [enter vehicle details](../../booking-pricing/enter-vehicle-details/README.md) and [add another vehicle](../../booking-pricing/add-another-vehicle/README.md); their diagrams still hold, with the fields below added.

## Description

- **`Vehicle`** (`SecondLook.Domain.Vehicles`) — adds `int Year`, `string Make`, `string Model`; `Vin` becomes `string?`.
- **`Inspection`** — the booking copy adds the same three fields and a nullable `Vin`. `CreateCheckout` copies them from the saved vehicle, so later edits never change a past inspection (ADR 0006).
- **`VehicleName.Of(year, make, model, vin)`** (`SecondLook.Domain.Vehicles`) — returns "2016 Honda Civic", or the VIN when no make is recorded (rows created before this change).
- **`VehicleRules.Validate`** — checks the year (1900 to next year by `TimeProvider`), make and model (required, up to 50 characters), and the VIN only when one is entered. The duplicate check in `AddVehicleHandler` and `UpdateVehicleHandler` runs only for a non-null VIN.
- **DTOs** — `VehicleDto`, `VehicleRequest` and `VehicleCopyDto` add `year`, `make`, `model`, with `vin` nullable. `HistoryItemDto`, `CallStateDto`, `ComparisonCarDto`, `ReportDto` and `AssignedReviewDto` add `vehicleName`, with `vin` nullable. The report PDF names the car the same way.
- **Migration `VehicleYearMakeModel`** — adds the columns to `Vehicles` and `Inspections` (defaults 0 and empty) and makes `Vin` nullable on both.
- **Frontend** — `validateVehicle` (`util/vehicle-form.ts`) and `VehicleDialog` ask for `v-year`, `v-make`, `v-model` before `v-vin` ("VIN (optional)") with the messages of `L2-085`. `vehicleName()` in the `api` library builds the same name on the client for `Vehicle` and the booking copy. Every page and dialog that titled a car by its VIN uses the name; the VIN moves to a muted detail and is left out when absent. The Vehicles table's first column becomes "Vehicle". `AddAnotherCarDialog` accepts an empty VIN.

## Requirements

| L2 ID | Refines (L1) | Requirement |
|-------|--------------|-------------|
| `L2-085` | `L1-005`, `L1-007`, `L1-018` | Year, make and model are required for a vehicle and name it everywhere; the VIN is optional and checked only when given. |

## Mocks

- `docs/mocks/dialogs/add-vehicle/*`, `docs/mocks/dialogs/edit-vehicle/*` — Year, Make, Model, then "VIN (optional)"; `add-vehicle/invalid.html` adds the missing model.
- `docs/mocks/pages/book-vehicle/*` — the same fields on the booking vehicle step.
- `docs/mocks/pages/vehicles/default.html` — the "Vehicle" column, with the VIN beneath when present.
- `docs/mocks/dialogs/add-another-car/*` — "VIN of the next car (optional)".

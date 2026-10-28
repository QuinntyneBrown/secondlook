# ADR 0004: Provider lifecycle and treatment of existing assignments

## Status
Accepted (J02)

## Context
`L2-064` lets an administrator onboard, approve and deactivate mechanics and body shops, and `docs/detailed-designs/marketplace-ops/administer-providers` leaves several rules open: how a provider account comes to exist, whether deactivation can be undone, and what happens to inspections already assigned.

## Decision
- A provider is a `User` with role `Mechanic` or `BodyShop` and an `ApprovalStatus` of `Pending`, `Approved` or `Deactivated`. Buyers and administrators are always `Approved`. `CanTakeInspections` is true only for an active, approved provider.
- Providers either register themselves (J01, status `Pending`) or are onboarded by an administrator, who supplies kind, name, email, licence number and location. Onboarding creates the account `Pending` without a password and emails the provider a set-your-password link (the reset-password flow). Onboarding the same email and kind again returns the existing provider; the same email with another kind or role is a conflict.
- Transitions: `Pending` to `Approved` (approve), `Approved` to `Deactivated` (deactivate), `Deactivated` to `Approved` (approve again, reactivation). Any other transition is a 409 conflict. Rejecting a pending provider is not offered; a pending provider simply stays pending.
- **Existing assignments:** deactivation blocks only new work. Inspections already assigned stay assigned to that provider, remain visible to them (L2-058) and are not cancelled or reassigned automatically. When inspections exist (J06 onward) the administrator sees them flagged for reassignment. Availability rows and slot holds are not deleted; slot search ignores providers that cannot take inspections.
- A deactivated provider can still sign in, so they can finish and read existing work.
- Administrator accounts are created by seeding or the CLI, never by self-registration.
- Notification of the provider and an audit trail of administrator actions are out of scope for J02.

## Consequences
No assignment data exists yet, so the reassignment flag is specified but not implemented; later journeys must honour `CanTakeInspections` when assigning and when listing slots.

# 02 · Administer mechanics and shops

This is the implementation demo for journey two. It is the real admin application and API running on this machine, with synthetic people and a local mailbox that sends no email. It shows how an administrator decides which mechanics and body shops can take inspections.

## The list

The administrator signs in and lands on the provider list. Each provider shows a kind, licence, location and status. The two seeded providers are already approved. Providers who register themselves arrive here as pending.

## Onboard

To add a provider, open the onboard dialog. With a bad email and nothing else filled in, the dialog lists exactly what to fix. Now a valid body shop. It is added as pending, which means it cannot take inspections yet, and it is emailed a link to set its own password.

## Approve and deactivate

Approving asks for confirmation, then the shop shows as approved and can take inspections. Deactivating also asks, and the safe choice, cancel, has the focus. The dialog explains that inspections already booked stay with the provider, and only new work stops. After deactivating, the shop shows as deactivated, and one more approval brings it back.

## Access

Only administrators can do any of this. A buyer who signs in to the admin app is told it is for administrators only, and the API refuses the same requests with a forbidden response.

## Recap

Here is what to remember. New providers start pending. Approval lets a provider take inspections, and deactivation stops new work without touching existing bookings. Every change is confirmed, and only administrators can make it. Next, journey three: manage availability.

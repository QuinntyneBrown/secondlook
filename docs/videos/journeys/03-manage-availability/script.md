# 03 · Manage availability

This is the implementation demo for journey three. It is the real application and API running on this machine, with synthetic people. It shows how an approved mechanic saves the times they can take inspections, and how buyers see only the times that are really free.

## Saving availability

The mechanic signs in and opens their availability. To add a window they open a dialog and choose a day and hours, in Eastern Time. A start that is not on the half hour, and an end before the start, are refused with a list of what to fix. Fixing them saves the window, which shows as eight half hour slots. A second window that overlaps the first is refused, and the dialog keeps what was typed. Editing a window works the same way, and here the start moves earlier.

## What buyers see

Now the buyer's side. A buyer asks for slots and gets only the half hour times inside the mechanic's window, in universal time with the Eastern zone named. When an administrator deactivates the mechanic, the same request returns nothing. Approving them again brings the slots back.

## Booked times

Booked times are protected too. A slot can be reserved only once, even when requests arrive together, and a window cannot be removed or shrunk over a booked slot. Those rules are covered by the automated tests, and the booking journeys will use them.

## Recap

Here is what to remember. Only approved providers save availability, and only their own. Windows cannot overlap, and times are entered in Eastern Time and stored in universal time. Buyers see only free slots from approved providers, and booked times are never lost. Next, journey four: manage vehicles.

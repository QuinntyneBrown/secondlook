# 04 · Manage vehicles

This is the implementation demo for journey four. It is the real application and API running on this machine, with a synthetic buyer. It shows how a buyer keeps a list of the cars they are comparing.

## The list

A new buyer opens Vehicles and sees an empty list. Adding a car opens a dialog. With a short VIN and a short phone number, the dialog lists exactly what to fix, and each field explains its own problem. A valid car is saved and appears in the list with its odometer, price and seller. Saving the same VIN again is refused, because it is already on the list. Editing a car works the same way, and the changes show right away. Removing a car asks first, and cancel is the focused choice.

## Whose cars

Every vehicle belongs to one buyer. Another buyer who asks for the list does not see it. Asking for that car by its identifier is answered as not found, and so is trying to delete it. The owner can read it, and can remove it. The buyer is always taken from the sign in token, never from the request, so there is no way to ask for someone else's car by name. That is true for reading, changing and deleting alike.

## History

Removing a car hides it from the list, but nothing is deleted. Inspections you have already booked keep the details they were booked with, so the history stays intact. A removed VIN can be saved again later. These rules are covered by the automated tests.

## Recap

Here is what to remember. Each buyer sees only their own cars. A VIN can be saved once at a time. Removing hides a car without erasing the record, and past inspections keep their own details. Next, journey five: pay for an inspection.

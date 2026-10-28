# 09 · Add a body shop review

This is the implementation demo for journey nine. It is the real application and API running on this machine, with synthetic people and the local payment adapter, so nothing is ever charged. It shows how a buyer adds a body shop review to a mechanic inspection.

## Booking a combined call

A buyer starts a booking and enters the car's details. On the review step there are three choices: mechanic, body shop, or both. Body shop alone costs the same as a mechanic review. Both adds twenty dollars, so the order shows seventy. Now the schedule step. A combined call needs a mechanic and a body shop on the same video call, so only times when both are free are offered. Here the mechanic is free from the hour and the body shop from half past, so a single shared time appears, and picking it names both people. The buyer pays and is booked, and the confirmation says both will inspect the car. The inspection shows the mechanic and the body shop.

## The server decides

Slots can be asked for by kind: mechanic, body shop, or both, and a combined slot exists only where both providers are free at the same start. Holding a combined time takes both slots together, all or nothing. If a second buyer asks for the same time, the answer is a conflict, and nothing is left half held. Once the call is booked, the shared time is no longer offered. If the paid review does not match the held times, the booking is refused without refunding, so the buyer can pick again. Cancelling releases both slots, and rescheduling moves both. These rules are written down as an architecture decision, and covered by tests.

## Recap

Here is what to remember. Body shop alone is the base price, and both adds twenty dollars. A combined call needs a mechanic and a body shop free at the same time. Both slots are held together or not at all. Next, journey ten: join a live video inspection.

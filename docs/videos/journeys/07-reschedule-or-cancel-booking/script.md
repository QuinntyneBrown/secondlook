# 07 · Reschedule or cancel a booking

This is the implementation demo for journey seven. It is the real application and API running on this machine, with synthetic people and the local payment adapter, so no real money moves. It shows how a buyer moves or cancels a booked inspection.

## Rescheduling

The buyer opens a booked inspection and chooses reschedule. The dialog offers the same mechanic's other free times. Submitting without choosing one asks for a new time. Choosing a time moves the call, and a message confirms the new time. If the buyer changes their mind, undo puts the call back where it was.

## Cancelling

Cancelling opens a dialog with the safe choice, keep inspection, focused. It asks for a reason, and refuses to continue without one. It also says what comes back: the full amount, to the card ending in four two four two, because the call is more than two hours away. After cancelling, the inspection shows as cancelled with the refund, the buttons to move or cancel are gone, and it moves to the past tab.

## Staying consistent

Moving and cancelling are safe under pressure. If another buyer takes the time someone wants to move to, the move is refused, and the original time stays booked. If a cancellation is sent five times at once, the buyer is still refunded exactly once. A cancellation less than two hours before the call keeps a twenty five dollar fee, and a call that has already started cannot be moved or cancelled. Those rules are covered by the automated tests.

## Recap

Here is what to remember. A reschedule keeps the same mechanic and frees the old time. A cancellation needs a reason, releases the slot, and refunds once. Only the buyer who booked can do either. Next, journey eight: add an additional vehicle.

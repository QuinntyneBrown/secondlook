# 06 · Book a video inspection

This is the implementation demo for journey six. It is the real application and API running on this machine, with synthetic people and the local payment adapter, so nothing is ever charged. It shows a buyer going from a car to a confirmed video inspection.

## Booking

A new buyer opens the dashboard and finds no inspections yet. Booking starts with the car and the seller. A short VIN and a short phone number are refused with a list of what to fix. Then the review: choosing both a mechanic and a body shop shows the server's price of seventy dollars. Next the time. The page offers only slots that are really free, grouped by day. Choosing one shows the mechanic, and continuing holds that slot for ten minutes. Then payment through the same flow as before. When the payment succeeds, the buyer is booked: the confirmation names the day, the time and the mechanic. The inspection shows the car, the time, the team and what was paid, and the dashboard lists it with its call time.

## Races and repeats

Booking is safe when things happen at once. When two buyers hold the same slot at the same moment, exactly one wins, and the other is told that the slot was just taken, and keeps their answers. When a booking is confirmed five times at once, there is still one inspection.

## Losing a slot

There is one more case. If a buyer pays after their hold has expired, and someone else took the slot in the meantime, the booking is refused, and the payment is refunded in full automatically. The buyer is never charged for a time they cannot have. This is covered by the automated tests.

## Recap

Here is what to remember. A booking is hold, pay, confirm. Only free slots are offered, and a slot can be held once. A paid checkout makes exactly one inspection, which keeps the vehicle details it was booked with. Next, journey seven: reschedule or cancel a booking.

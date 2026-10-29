# 12 · Conduct a body shop review

This is the implementation demo for journey twelve. It is the real application and API running on this machine, with synthetic people and the local adapters, so nothing is charged or sent. It shows a body shop doing its part of a review, and the buyer reading it beside the mechanic's.

## The shop's queue

The body shop signs in and opens its assigned reviews. Each row is one of its own inspections, with where the call stands. One is waiting for its call, one has ended and needs findings, and two are delivered. The shop joins the waiting call from the queue, and lands in the same lobby as the buyer and the mechanic. No other shop's inspections appear here.

## Writing the findings

After the call, the shop opens the call that has ended and chooses Write findings. This is the same editor the mechanic used, for the body shop. The shop adds a dent that must be repaired, paint that is worth freshening, and a hood that passes. Submit review sends it, and the queue now shows it as delivered.

## What the buyer reads

The buyer's report keeps two parts apart. The mechanic's estimate sets the cost to get the car safety certified, and the body shop's findings sit in their own part, naming who wrote them. The body repairs never change the certification cost, and the report says so. A review with the body shop alone shows only the shop's findings, with no certification estimate, because there is no mechanic.

## The rules

The server decides who may do what. The body shop cannot write its review before the call has ended. The buyer and the mechanic cannot write the body shop's part. A shop that is not assigned finds nothing, and so does a stranger. Empty findings are refused, and the queue belongs to the body shop alone.

## Recap

Here is what to remember. The body shop's review is its own part of the report, with its own author. It never changes the certification cost. Each part can be delivered on its own, and a review with the shop alone needs no estimate. Not built yet: notifying the buyer, and recording. Next, journey thirteen: compare vehicle estimates.

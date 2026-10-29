# 14 · Review inspection history

This is the implementation demo for journey fourteen, the last of the buyer's journeys. It is the real application and API running on this machine, with synthetic people and the local adapters, so nothing is charged or sent. It shows a buyer revisiting what they have had inspected.

## Active and Past

This buyer has four inspections. The Active tab holds the two that are not finished with: one booked for later, and one whose call is done while the report is still being written. The Past tab holds a completed inspection, with its estimate right on the row, required repairs and what they cost, and a cancelled one. Opening the completed row goes to its report. Going back returns to the Past tab, because the tab is in the address. Opening the cancelled row shows the car and the refund it was booked with, so history never changes after the fact.

## A long history

Now a buyer with forty-five past inspections. The list shows twenty to a page, says how many there are, and says which rows are on screen. Previous is disabled on the first page. Next moves on, and the last page shows the five that remain, with Next disabled and Previous available.

## Empty, failed and busy

A buyer with no inspections sees how to start, and can open a sample report, clearly marked as made up. Back on the buyer with four inspections, a list that fails to load says it is on our side, that the bookings are safe, and offers Try again or a way to contact support. Trying again shows the list busy with placeholder rows, then the inspections.

## Only your own history

The rules are enforced by the server. The tabs and their counts come from the same request. A page past the end is empty, a different buyer sees none of these inspections, and an unknown tab is refused. The mechanic is refused, and so is a request with no token.

## Recap

Here is what to remember. Active holds what is not finished with, and Past holds completed and cancelled inspections with their estimates. Pages keep a long history manageable, and the tab and page are in the address. A buyer only ever sees their own inspections. That completes the journeys. Not built yet: make, model and location on each row, and a retention policy.

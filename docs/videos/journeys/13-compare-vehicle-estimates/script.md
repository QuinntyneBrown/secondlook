# 13 · Compare vehicle estimates

This is the implementation demo for journey thirteen. It is the real application and API running on this machine, with synthetic people and the local adapters, so nothing is charged or sent. It shows a buyer lining up the cars they have had inspected.

## Lining the cars up

This buyer has had four cars inspected in the same window. They open Compare from the navigation. Three cars have an estimate, so they are lined up lowest all-in first, where all-in is the asking price plus the cost to get the car safety certified. The cheapest is marked as the lowest all-in. The fourth car is still waiting for its mechanic's estimate, so it sits at the end and says so, rather than disappearing. The note reminds the buyer that the cheapest car isn't always the best car. Opening the lowest car's report shows the same total as its column.

## On a phone

The same page on a phone. The cars stack in one column, each with the same details: the car, its kilometres, the all-in total, the asking price and the cost to certify. The lowest all-in car keeps its mark, and the car still waiting for its estimate still comes last. Nothing scrolls sideways, so a buyer can compare cars while standing next to one.

## Only your own cars

The rules are enforced by the server. The buyer with four cars gets the four, with the lowest marked. A different buyer, with two cars of their own, gets only those. A buyer with no inspections gets an empty comparison. The mechanic is refused, and so is a request with no token. The lowest car's own report shows the same all-in total as its column, because the comparison is computed from the reports.

## Recap

Here is what to remember. Compare lines up the cars from one window, lowest all-in first. A car without an estimate stays in the list as pending. It works on a phone, and a buyer only ever sees their own cars. Not built yet: the car's make, model and location. Next, journey fourteen: review inspection history.

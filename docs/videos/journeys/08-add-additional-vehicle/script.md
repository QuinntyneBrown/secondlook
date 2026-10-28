# 08 · Add an additional vehicle

This is the implementation demo for journey eight. It is the real application and API running on this machine, with synthetic people and the local payment adapter, so nothing is ever charged. It shows how a buyer adds a second car at the cheaper price.

## Adding a second car

A buyer who has already booked one car sees a banner on the dashboard: their window is open until a date two weeks out, and another car to compare is twenty five dollars. The add another car button opens a dialog. Continuing without a VIN puts focus on the VIN field and says what is missing. Now the next car's VIN and both reviews. The booking flow opens with that VIN already filled in, and the review already chosen. The order shows forty five dollars: twenty five for an additional vehicle, plus twenty for both reviews. The buyer picks a time, pays, and is booked. Back on the dashboard, a message says the car was added, and how many cars are now in the window.

## The server decides

The price is never worked out in the browser. A buyer who has not paid yet has no window, and a first inspection is fifty dollars. After the first payment the server opens a window. From then on another car quotes at twenty five. The window lasts fourteen days, and it is open up to, but not including, its last instant. With two days or less left it warns, and the warning can be dismissed. Once it has closed, a new inspection is fifty dollars again and starts a new window. Cancelling or refunding a car never changes the window, but refunded cars stop counting. These rules are written down as an architecture decision, and covered by tests.

## Recap

Here is what to remember. A window is fourteen days from the first payment. Inside it another car is twenty five dollars, and both reviews add twenty. The server decides eligibility and price, so the banner, the dialog and the checkout always agree. Next, journey nine: add a body shop review.

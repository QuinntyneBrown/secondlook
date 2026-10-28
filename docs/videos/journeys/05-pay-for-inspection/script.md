# 05 · Pay for an inspection

This is the implementation demo for journey five. It is the real application and API running on this machine, with a synthetic buyer and a local payment adapter. No real card is used and nothing is ever charged.

## Paying

The buyer opens the Pay step. The order and the price come from the server: fifty dollars for a first inspection. A card number with too few digits, a bad expiry and no security code is refused with a list of what to fix. A test card that the bank declines shows that the card was declined, says nothing was charged, and offers to add a different card. A card that works pays, and the page confirms the amount and the last four digits. The receipt appears in billing history, described as a first inspection. And the next vehicle is cheaper: with both reviews it comes to forty five dollars.

## Safe payments

Payments are safe to repeat. Creating the same checkout twice, with the same key, returns the same checkout. Five payment requests sent at the very same moment all return the same single payment, and the card is charged once. The browser sends card details only to the payment processor and gets back a token, so the card number never reaches our API, and we keep only the brand and the last four digits.

## Refunds

The refund rules are in place for the booking journeys to use. A seller who does not show, or an inspection that cannot finish, refunds in full. Cancelling more than two hours before the call refunds in full, and cancelling later keeps a twenty five dollar fee. A report that has been delivered is not refundable. These rules are covered by the automated tests.

## Recap

Here is what to remember. The server decides every price. A payment goes through once, however many times it is sent. Card details never touch our database. Next, journey six: book a video inspection.

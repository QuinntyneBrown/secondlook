# ADR 0007: Server-owned pricing, checkout, payment adapter and refunds

## Status
Accepted (J05)

## Context
`L2-027` to `L2-032` set the price rules, checkout, idempotent payment, billing history and refunds. The booking journeys (J06 onward) own slot reservation and confirmation; this journey must leave them a durable checkout and payment contract, and must never store raw card details.

## Decision
- **Price is computed only on the server** (`PriceCalculator`): the first review in a pricing window is $50 (mechanic), every additional vehicle in the same window is $25, and choosing both reviews adds $20. A pricing window lasts 14 days and starts when the first payment succeeds; once closed, the next payment is $50 and starts a new window. The client never sends a price.
- **Quote and charge use one function.** A `Checkout` (pending) holds the buyer, the review choice and an optional vehicle reference; its quote is recomputed from the rules each time it is read and again at the moment of payment, so what the buyer saw is what is charged, and a window that opened in between is honoured.
- **Checkout is durable and idempotent:** `POST /api/checkouts` carries a client `idempotencyKey`; posting the same key again returns the existing checkout. A checkout is `Pending` until a payment succeeds, then `Paid`. Booking (J06) attaches the slot and confirms; it reads the checkout, it does not re-price.
- **Payment is idempotent:** one successful `Payment` per checkout (unique index on the checkout id for successful payments). Paying a paid checkout returns the existing payment and does not charge again; concurrent pays charge once. The processor call also carries the checkout id as its own idempotency reference.
- **Card data never reaches our database or our payment endpoint.** The browser sends card details to the processor adapter's tokenisation endpoint (standing in for the processor's hosted fields) and receives an opaque token; `pay` takes only that token. We store brand and last four digits. The local adapter keeps token details in memory only and recognises documented test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0025 0000 3155` needs bank approval. No real charge is ever made; a real processor is a later adapter behind `IPaymentProcessor`.
- **Declines and bank approval:** a decline is a 402 problem and the checkout stays `Pending` ("You haven’t been charged"); a bank-approval request is a 202 `RequiresAction` and the checkout stays `Pending`.
- **Refunds (contract):** `RefundPaymentCommand` applies `L2-032`: a seller no-show, an incomplete inspection, or a buyer cancellation more than 2 hours before the call refunds in full; a cancellation less than 2 hours before refunds the amount minus a $25 retained fee (never below zero); a delivered report is not refundable (409). A payment is refunded once. The booking journeys call it; there is no buyer-facing refund endpoint here.
- **Billing history** lists the buyer's payments newest first with what was bought, the amount and the status (`Paid`, `Refunded`, `Partially refunded`).
- Money is stored in integer cents.

## Consequences
The booking journeys can create a checkout, show its live quote and pay it without touching card data or prices. Saved cards (`L2-017`) are not built here; the first card is entered per payment. A real processor needs a new adapter and webhooks for asynchronous confirmation.

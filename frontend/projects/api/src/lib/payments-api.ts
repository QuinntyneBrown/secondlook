import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ReviewChoice = 'Mechanic' | 'BodyShop' | 'Both';

export interface CardDetails {
  cardNumber: string;
  expiry: string;
  securityCode: string;
  nameOnCard: string;
  postalCode: string;
}

/** An opaque processor token: the only thing the pay call takes, so card details never reach our own API. */
export interface CardToken {
  token: string;
  brand: string;
  last4: string;
}

export interface QuoteLine {
  label: string;
  cents: number;
}

export interface Checkout {
  id: string;
  review: ReviewChoice;
  status: 'Pending' | 'Paid';
  quote: { lines: QuoteLine[]; totalCents: number };
  createdAt: string;
}

export type PayOutcome =
  | { status: 'Paid'; paymentId: string; amountCents: number; cardBrand: string; cardLast4: string }
  | { status: 'RequiresAction'; message: string };

export interface Receipt {
  paymentId: string;
  date: string;
  for: string;
  amountCents: number;
  status: 'Paid' | 'Refunded' | 'Partially refunded';
}

/**
 * Checkout and payments. Prices come from the server. Errors are `ApiProblem`s:
 * 400 field errors, and 402 with `detail` when the card is declined.
 */
export interface PaymentsApi {
  tokenize(card: CardDetails): Observable<CardToken>;
  createCheckout(review: ReviewChoice, idempotencyKey: string): Observable<Checkout>;
  getCheckout(id: string): Observable<Checkout>;
  pay(checkoutId: string, paymentToken: string): Observable<PayOutcome>;
  receipts(): Observable<Receipt[]>;
}

export const PAYMENTS_API = new InjectionToken<PaymentsApi>('PAYMENTS_API');

import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewChoice } from './payments-api';

export interface Slot {
  providerId: string;
  providerName: string;
  kind: 'Mechanic' | 'BodyShop';
  /** UTC ISO instants. */
  start: string;
  end: string;
}

export interface Hold {
  holdId: string;
  providerId: string;
  providerName: string;
  start: string;
  end: string;
  expiresAt: string;
}

export interface InspectionVehicle {
  vin: string;
  odometerKm: number;
  askingPrice: number;
  listingUrl: string | null;
  sellerName: string;
  sellerPhone: string;
}

export interface Inspection {
  id: string;
  status: string;
  start: string;
  end: string;
  mechanicName: string | null;
  review: ReviewChoice;
  amountCents: number;
  vehicle: InspectionVehicle;
  createdAt: string;
  cardLast4: string | null;
  /** What cancelling now would refund, in cents. */
  refundPreviewCents: number;
  cancelledAt: string | null;
  refundedCents: number;
  retainedCents: number;
  /** True while the call has not started and the inspection is scheduled. */
  canChange: boolean;
}

export type CancelReason = 'DifferentCar' | 'SellerBackedOut' | 'PriceChanged' | 'Other';

/**
 * Booking: free slots, a 10-minute hold, confirmation of a paid checkout, and the buyer's inspections.
 * Errors are `ApiProblem`s: 409 "We couldn’t hold that slot" (also after paying, in which case the payment is refunded).
 */
export interface BookingsApi {
  slots(kind?: 'Mechanic' | 'BodyShop'): Observable<Slot[]>;
  hold(providerId: string, start: string): Observable<Hold>;
  confirm(checkoutId: string, holdId: string, vehicleId: string): Observable<Inspection>;
  inspections(): Observable<Inspection[]>;
  inspection(id: string): Observable<Inspection>;
  rescheduleSlots(id: string): Observable<Slot[]>;
  reschedule(id: string, start: string): Observable<Inspection>;
  cancel(id: string, reason: CancelReason): Observable<Inspection>;
}

export const BOOKINGS_API = new InjectionToken<BookingsApi>('BOOKINGS_API');

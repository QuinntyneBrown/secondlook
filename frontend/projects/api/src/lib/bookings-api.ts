import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewChoice } from './payments-api';

export interface Slot {
  providerId: string;
  providerName: string;
  kind: 'Mechanic' | 'BodyShop' | 'Both';
  /** UTC ISO instants. */
  start: string;
  end: string;
  /** Set on a combined call: the body shop that is free at the same time as the mechanic. */
  bodyShopId?: string | null;
  bodyShopName?: string | null;
}

export interface Hold {
  holdId: string;
  providerId: string;
  providerName: string;
  start: string;
  end: string;
  expiresAt: string;
  /** The body shop's slot of a combined call. */
  bodyShopHoldId?: string | null;
  bodyShopName?: string | null;
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
  bodyShopName: string | null;
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
  slots(kind?: 'Mechanic' | 'BodyShop' | 'Both'): Observable<Slot[]>;
  /** For a combined call pass the mechanic as `providerId` and the body shop as `bodyShopId`. */
  hold(providerId: string, start: string, bodyShopId?: string | null): Observable<Hold>;
  confirm(
    checkoutId: string,
    holdId: string,
    vehicleId: string,
    bodyShopHoldId?: string | null,
  ): Observable<Inspection>;
  inspections(): Observable<Inspection[]>;
  inspection(id: string): Observable<Inspection>;
  rescheduleSlots(id: string): Observable<Slot[]>;
  reschedule(id: string, start: string): Observable<Inspection>;
  cancel(id: string, reason: CancelReason): Observable<Inspection>;
}

export const BOOKINGS_API = new InjectionToken<BookingsApi>('BOOKINGS_API');

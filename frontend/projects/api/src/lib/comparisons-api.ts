import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { ReviewType } from './reports-api';

/**
 * Ready: the mechanic's estimate is in, so the costs are set. Pending: it is not written yet. NoEstimate: a review with the
 * body shop alone has no certification estimate to compare.
 */
export type ComparisonStatus = 'Ready' | 'Pending' | 'NoEstimate';

export interface ComparisonColumn {
  inspectionId: string;
  vin: string;
  odometerKm: number;
  askingPriceCents: number;
  review: ReviewType;
  status: ComparisonStatus;
  costMinCents: number | null;
  costMaxCents: number | null;
  allInMinCents: number | null;
  allInMaxCents: number | null;
  /** True for the cheapest all-in car (and any tied with it) once two cars can be compared. */
  lowest: boolean;
}

export interface Comparison {
  window: { startsAt: string; endsAt: string; open: boolean } | null;
  /** Cars with an estimate first, lowest all-in first; then the rest by call time. */
  columns: ComparisonColumn[];
  readyCount: number;
}

/** The buyer's cars from their latest pricing window, lined up (ADR 0015). Errors are `ApiProblem`s. */
export interface ComparisonsApi {
  get(): Observable<Comparison>;
}

export const COMPARISONS_API = new InjectionToken<ComparisonsApi>('COMPARISONS_API');

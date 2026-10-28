import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** A span of time, in UTC (ISO 8601), during which the signed-in provider can take inspections. */
export interface AvailabilityWindow {
  id: string;
  start: string;
  end: string;
}

/** Provider availability. Errors are `ApiProblem`s (403 not approved, 409 overlap or booked). */
export interface AvailabilityApi {
  list(): Observable<AvailabilityWindow[]>;
  add(start: string, end: string): Observable<AvailabilityWindow>;
  update(id: string, start: string, end: string): Observable<AvailabilityWindow>;
  remove(id: string): Observable<void>;
}

export const AVAILABILITY_API = new InjectionToken<AvailabilityApi>('AVAILABILITY_API');

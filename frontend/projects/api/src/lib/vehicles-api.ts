import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  /** Optional (ADR 0018). */
  vin: string | null;
  odometerKm: number;
  askingPrice: number;
  listingUrl: string | null;
  sellerName: string;
  sellerPhone: string;
}

export type VehicleInput = Omit<Vehicle, 'id'>;

/** How a car is named on screen (ADR 0018): "2016 Honda Civic", or its VIN when no make was recorded. */
export function vehicleName(v: Pick<Vehicle, 'year' | 'make' | 'model' | 'vin'>): string {
  return v.make ? `${v.year} ${v.make} ${v.model}` : (v.vin ?? '');
}

/** The signed-in buyer's saved vehicles. Errors are `ApiProblem`s (400 field errors, 409 duplicate VIN). */
export interface VehiclesApi {
  list(): Observable<Vehicle[]>;
  add(vehicle: VehicleInput): Observable<Vehicle>;
  update(id: string, vehicle: VehicleInput): Observable<Vehicle>;
  remove(id: string): Observable<void>;
}

export const VEHICLES_API = new InjectionToken<VehiclesApi>('VEHICLES_API');

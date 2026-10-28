import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export interface Vehicle {
  id: string;
  vin: string;
  odometerKm: number;
  askingPrice: number;
  listingUrl: string | null;
  sellerName: string;
  sellerPhone: string;
}

export type VehicleInput = Omit<Vehicle, 'id'>;

/** The signed-in buyer's saved vehicles. Errors are `ApiProblem`s (400 field errors, 409 duplicate VIN). */
export interface VehiclesApi {
  list(): Observable<Vehicle[]>;
  add(vehicle: VehicleInput): Observable<Vehicle>;
  update(id: string, vehicle: VehicleInput): Observable<Vehicle>;
  remove(id: string): Observable<void>;
}

export const VEHICLES_API = new InjectionToken<VehiclesApi>('VEHICLES_API');

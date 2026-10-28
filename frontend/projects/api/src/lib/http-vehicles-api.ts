import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { API_BASE_URL } from './http-platform-api';
import { Vehicle, VehicleInput, VehiclesApi } from './vehicles-api';

function toProblem(e: unknown): ApiProblem {
  if (e instanceof HttpErrorResponse) {
    const body = (e.error ?? {}) as {
      title?: string;
      detail?: string;
      errors?: Record<string, string[]>;
    };
    return {
      status: e.status,
      title: body.title ?? e.statusText,
      detail: body.detail,
      errors: body.errors,
    };
  }
  return { status: 0, title: 'Request failed' };
}

@Injectable()
export class HttpVehiclesApi implements VehiclesApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/vehicles`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  list() {
    return this.guard(this.http.get<Vehicle[]>(this.base));
  }

  add(vehicle: VehicleInput) {
    return this.guard(this.http.post<Vehicle>(this.base, vehicle));
  }

  update(id: string, vehicle: VehicleInput) {
    return this.guard(this.http.put<Vehicle>(`${this.base}/${id}`, vehicle));
  }

  remove(id: string) {
    return this.guard(this.http.delete(`${this.base}/${id}`)).pipe(map(() => undefined));
  }
}

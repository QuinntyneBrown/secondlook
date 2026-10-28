import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { BookingsApi, CancelReason, Hold, Inspection, Slot } from './bookings-api';
import { API_BASE_URL } from './http-platform-api';

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
export class HttpBookingsApi implements BookingsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  slots(kind?: 'Mechanic' | 'BodyShop') {
    const params = kind ? new HttpParams().set('kind', kind) : new HttpParams();
    return this.guard(
      this.http.get<{ slots: Slot[] }>(`${this.base}/slots`, { params }).pipe(map((r) => r.slots)),
    );
  }

  hold(providerId: string, start: string) {
    return this.guard(this.http.post<Hold>(`${this.base}/bookings/holds`, { providerId, start }));
  }

  confirm(checkoutId: string, holdId: string, vehicleId: string) {
    return this.guard(
      this.http.post<Inspection>(`${this.base}/bookings`, { checkoutId, holdId, vehicleId }),
    );
  }

  inspections() {
    return this.guard(
      this.http
        .get<{ inspections: Inspection[] }>(`${this.base}/inspections`)
        .pipe(map((r) => r.inspections)),
    );
  }

  inspection(id: string) {
    return this.guard(this.http.get<Inspection>(`${this.base}/inspections/${id}`));
  }

  rescheduleSlots(id: string) {
    return this.guard(
      this.http
        .get<{ slots: Slot[] }>(`${this.base}/inspections/${id}/reschedule-slots`)
        .pipe(map((r) => r.slots)),
    );
  }

  reschedule(id: string, start: string) {
    return this.guard(
      this.http.post<Inspection>(`${this.base}/inspections/${id}/reschedule`, { start }),
    );
  }

  cancel(id: string, reason: CancelReason) {
    return this.guard(
      this.http.post<Inspection>(`${this.base}/inspections/${id}/cancel`, { reason }),
    );
  }
}

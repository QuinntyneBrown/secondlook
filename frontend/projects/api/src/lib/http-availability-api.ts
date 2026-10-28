import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { AvailabilityApi, AvailabilityWindow } from './availability-api';
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
export class HttpAvailabilityApi implements AvailabilityApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/availability`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  list() {
    return this.guard(this.http.get<AvailabilityWindow[]>(this.base));
  }

  add(start: string, end: string) {
    return this.guard(this.http.post<AvailabilityWindow>(this.base, { start, end }));
  }

  update(id: string, start: string, end: string) {
    return this.guard(this.http.put<AvailabilityWindow>(`${this.base}/${id}`, { start, end }));
  }

  remove(id: string) {
    return this.guard(this.http.delete(`${this.base}/${id}`)).pipe(map(() => undefined));
  }
}

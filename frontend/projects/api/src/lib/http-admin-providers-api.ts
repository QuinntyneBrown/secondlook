import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import {
  AdminProvidersApi,
  OnboardProvider,
  Provider,
  ProviderFilter,
} from './admin-providers-api';
import { ApiProblem } from './auth-api';
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
export class HttpAdminProvidersApi implements AdminProvidersApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api/admin/providers`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  list(filter: ProviderFilter = {}) {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.kind) params = params.set('kind', filter.kind);
    return this.guard(this.http.get<Provider[]>(this.base, { params }));
  }

  onboard(provider: OnboardProvider) {
    return this.guard(this.http.post<Provider>(this.base, provider));
  }

  approve(id: string) {
    return this.guard(this.http.post(`${this.base}/${id}/approve`, {})).pipe(map(() => undefined));
  }

  deactivate(id: string) {
    return this.guard(this.http.post(`${this.base}/${id}/deactivate`, {})).pipe(
      map(() => undefined),
    );
  }
}

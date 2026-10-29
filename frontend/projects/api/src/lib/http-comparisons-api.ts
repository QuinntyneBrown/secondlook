import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { Comparison, ComparisonsApi } from './comparisons-api';
import { API_BASE_URL } from './http-platform-api';

function toProblem(e: unknown): ApiProblem {
  if (e instanceof HttpErrorResponse) {
    const body = (e.error ?? {}) as { title?: string; detail?: string };
    return { status: e.status, title: body.title ?? e.statusText, detail: body.detail };
  }
  return { status: 0, title: 'Request failed' };
}

@Injectable()
export class HttpComparisonsApi implements ComparisonsApi {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(API_BASE_URL);

  get() {
    return this.http
      .get<Comparison>(`${this.origin}/api/comparisons`)
      .pipe(catchError((e) => throwError(() => toProblem(e))));
  }
}

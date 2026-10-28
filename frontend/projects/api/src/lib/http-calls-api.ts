import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { ACCESS_TOKEN, ApiProblem } from './auth-api';
import { CallState, CallsApi } from './calls-api';
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
export class HttpCallsApi implements CallsApi {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(API_BASE_URL);
  private readonly token = inject(ACCESS_TOKEN);
  private readonly base = `${this.origin}/api/calls`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  get(id: string) {
    return this.guard(this.http.get<CallState>(`${this.base}/${id}`));
  }

  join(id: string) {
    return this.guard(this.http.post<CallState>(`${this.base}/${id}/join`, {}));
  }

  end(id: string) {
    return this.guard(this.http.post<CallState>(`${this.base}/${id}/end`, {}));
  }

  advanceChecklist(id: string) {
    return this.guard(this.http.post<CallState>(`${this.base}/${id}/checklist/advance`, {}));
  }

  addNote(id: string, text: string) {
    return this.guard(this.http.post<CallState>(`${this.base}/${id}/notes`, { text }));
  }

  socketUrl(id: string) {
    const origin = this.origin.replace(/^http/, 'ws');
    return `${origin}/api/calls/${id}/ws?access_token=${encodeURIComponent(this.token() ?? '')}`;
  }
}

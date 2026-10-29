import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { API_BASE_URL } from './http-platform-api';
import {
  AssignedReview,
  FindingInput,
  IssueReason,
  Report,
  ReportShare,
  ReportsApi,
} from './reports-api';

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
export class HttpReportsApi implements ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(API_BASE_URL);

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  private base(id: string) {
    return `${this.origin}/api/inspections/${id}/report`;
  }

  get(id: string) {
    return this.guard(this.http.get<Report>(this.base(id)));
  }

  submit(id: string, findings: FindingInput[]) {
    return this.guard(this.http.put<Report>(this.base(id), { findings }));
  }

  submitBodyShop(id: string, findings: FindingInput[]) {
    return this.guard(this.http.put<Report>(`${this.base(id)}/body-shop`, { findings }));
  }

  assigned() {
    return this.guard(this.http.get<AssignedReview[]>(`${this.origin}/api/reviews/assigned`));
  }

  share(id: string, includeBodyShop: boolean) {
    return this.guard(this.http.put<ReportShare>(`${this.base(id)}/share`, { includeBodyShop }));
  }

  emailShare(id: string, email: string) {
    return this.guard(
      this.http.post(`${this.base(id)}/share/email`, { email }).pipe(map(() => undefined)),
    );
  }

  turnOffShare(id: string) {
    return this.guard(this.http.delete<void>(`${this.base(id)}/share`));
  }

  getShared(token: string) {
    return this.guard(
      this.http.get<Report>(`${this.origin}/api/shared-reports/${encodeURIComponent(token)}`),
    );
  }

  pdf(id: string) {
    return this.guard(this.http.get(`${this.base(id)}/pdf`, { responseType: 'blob' }));
  }

  reportIssue(id: string, reason: IssueReason | '', details: string) {
    return this.guard(
      this.http.post(`${this.base(id)}/issues`, { reason, details }).pipe(map(() => undefined)),
    );
  }
}

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem } from './auth-api';
import { API_BASE_URL } from './http-platform-api';
import {
  CardDetails,
  CardToken,
  Checkout,
  PayOutcome,
  PaymentsApi,
  Receipt,
  ReviewChoice,
} from './payments-api';

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
export class HttpPaymentsApi implements PaymentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api`;

  private guard<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  tokenize(card: CardDetails) {
    return this.guard(this.http.post<CardToken>(`${this.base}/payments/tokens`, card));
  }

  createCheckout(review: ReviewChoice, idempotencyKey: string, vehicleId?: string) {
    return this.guard(
      this.http.post<Checkout>(`${this.base}/checkouts`, { review, idempotencyKey, vehicleId }),
    );
  }

  getCheckout(id: string) {
    return this.guard(this.http.get<Checkout>(`${this.base}/checkouts/${id}`));
  }

  pay(checkoutId: string, paymentToken: string) {
    return this.guard(
      this.http.post<PayOutcome>(`${this.base}/checkouts/${checkoutId}/pay`, { paymentToken }),
    );
  }

  receipts() {
    return this.guard(
      this.http
        .get<{ receipts: Receipt[] }>(`${this.base}/billing/receipts`)
        .pipe(map((r) => r.receipts)),
    );
  }
}

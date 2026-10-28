import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiProblem, AuthApi, Profile, RegisterRequest, SignedIn } from './auth-api';
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
export class HttpAuthApi implements AuthApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/api`;

  private post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(`${this.base}${path}`, body ?? {})
      .pipe(catchError((e) => throwError(() => toProblem(e))));
  }

  register(request: RegisterRequest) {
    return this.post('/auth/register', request).pipe(map(() => undefined));
  }

  verifyEmail(token: string) {
    return this.post('/auth/verify-email', { token }).pipe(map(() => undefined));
  }

  resendVerification(email: string) {
    return this.post('/auth/resend-verification', { email }).pipe(map(() => undefined));
  }

  signIn(email: string, password: string) {
    return this.post<SignedIn>('/auth/login', { email, password });
  }

  forgotPassword(email: string) {
    return this.post('/auth/forgot-password', { email }).pipe(map(() => undefined));
  }

  resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return this.post<{ token: string }>('/auth/reset-password', {
      token,
      newPassword,
      confirmPassword,
    });
  }

  signOut() {
    return this.post('/auth/logout').pipe(map(() => undefined));
  }

  me() {
    return this.http
      .get<Profile>(`${this.base}/platform/me`)
      .pipe(catchError((e) => throwError(() => toProblem(e))));
  }
}

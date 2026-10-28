import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type AccountRole = 'Buyer' | 'Mechanic' | 'BodyShop' | 'Admin';

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
  role?: AccountRole;
}

export interface SignedIn {
  token: string;
  role: AccountRole;
  isApproved: boolean;
  displayName: string;
}

export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  role: AccountRole;
}

/** A failed call, as a problem+json the pages can react to without knowing HTTP. */
export interface ApiProblem {
  /** HTTP status; 0 when the API could not be reached. */
  status: number;
  title: string;
  detail?: string;
  /** Field name to messages, for 400 validation problems. */
  errors?: Record<string, string[]>;
}

/** Account contract. Pages depend on `AUTH_API`, never on the HTTP implementation. */
export interface AuthApi {
  register(request: RegisterRequest): Observable<void>;
  verifyEmail(token: string): Observable<void>;
  resendVerification(email: string): Observable<void>;
  signIn(email: string, password: string): Observable<SignedIn>;
  forgotPassword(email: string): Observable<void>;
  resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string,
  ): Observable<{ token: string }>;
  signOut(): Observable<void>;
  me(): Observable<Profile>;
}

export const AUTH_API = new InjectionToken<AuthApi>('AUTH_API');

/** Supplies the current access token, or null when signed out; the HTTP layer attaches it as a bearer token. */
export const ACCESS_TOKEN = new InjectionToken<() => string | null>('ACCESS_TOKEN', {
  factory: () => () => null,
});

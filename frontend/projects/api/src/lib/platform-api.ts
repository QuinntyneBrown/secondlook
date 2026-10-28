import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/** Platform-level API contract: what the shells need before any product workflow exists. */
export interface PlatformApi {
  /** Completes when `GET /health/ready` answers 200; errors when the API or its database is down. */
  ready(): Observable<void>;
}

/** Pages depend on this token, never on the HTTP implementation. */
export const PLATFORM_API = new InjectionToken<PlatformApi>('PLATFORM_API');

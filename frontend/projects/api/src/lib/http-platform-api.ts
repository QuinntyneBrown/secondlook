import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PlatformApi } from './platform-api';

/** Origin of the SecondLook API, e.g. `http://localhost:5100`. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

@Injectable()
export class HttpPlatformApi implements PlatformApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  ready(): Observable<void> {
    return this.http.get(`${this.baseUrl}/health/ready`).pipe(map(() => undefined));
  }
}

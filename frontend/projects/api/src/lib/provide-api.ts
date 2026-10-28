import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { ACCESS_TOKEN, AUTH_API } from './auth-api';
import { HttpAuthApi } from './http-auth-api';
import { API_BASE_URL, HttpPlatformApi } from './http-platform-api';
import { PLATFORM_API } from './platform-api';

export function provideApi(baseUrl: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(
      withInterceptors([
        (req, next) => {
          const token = inject(ACCESS_TOKEN)();
          return next(
            token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req,
          );
        },
      ]),
    ),
    { provide: API_BASE_URL, useValue: baseUrl },
    { provide: PLATFORM_API, useClass: HttpPlatformApi },
    { provide: AUTH_API, useClass: HttpAuthApi },
  ]);
}

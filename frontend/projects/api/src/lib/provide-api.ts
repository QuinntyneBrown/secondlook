import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { ADMIN_PROVIDERS_API } from './admin-providers-api';
import { ACCESS_TOKEN, AUTH_API } from './auth-api';
import { AVAILABILITY_API } from './availability-api';
import { HttpAdminProvidersApi } from './http-admin-providers-api';
import { HttpAuthApi } from './http-auth-api';
import { HttpAvailabilityApi } from './http-availability-api';
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
    { provide: AVAILABILITY_API, useClass: HttpAvailabilityApi },
    { provide: ADMIN_PROVIDERS_API, useClass: HttpAdminProvidersApi },
  ]);
}

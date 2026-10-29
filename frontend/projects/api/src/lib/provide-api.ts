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
import { BOOKINGS_API } from './bookings-api';
import { CALLS_API } from './calls-api';
import { HttpCallsApi } from './http-calls-api';
import { HttpReportsApi } from './http-reports-api';
import { COMPARISONS_API } from './comparisons-api';
import { HttpComparisonsApi } from './http-comparisons-api';
import { REPORTS_API } from './reports-api';
import { HttpBookingsApi } from './http-bookings-api';
import { HttpPaymentsApi } from './http-payments-api';
import { HttpVehiclesApi } from './http-vehicles-api';
import { PAYMENTS_API } from './payments-api';
import { VEHICLES_API } from './vehicles-api';

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
    { provide: VEHICLES_API, useClass: HttpVehiclesApi },
    { provide: PAYMENTS_API, useClass: HttpPaymentsApi },
    { provide: BOOKINGS_API, useClass: HttpBookingsApi },
    { provide: CALLS_API, useClass: HttpCallsApi },
    { provide: REPORTS_API, useClass: HttpReportsApi },
    { provide: COMPARISONS_API, useClass: HttpComparisonsApi },
    { provide: ADMIN_PROVIDERS_API, useClass: HttpAdminProvidersApi },
  ]);
}

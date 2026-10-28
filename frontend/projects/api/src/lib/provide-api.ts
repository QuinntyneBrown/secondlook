import { provideHttpClient } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { API_BASE_URL, HttpPlatformApi } from './http-platform-api';
import { PLATFORM_API } from './platform-api';

export function provideApi(baseUrl: string): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(),
    { provide: API_BASE_URL, useValue: baseUrl },
    { provide: PLATFORM_API, useClass: HttpPlatformApi },
  ]);
}

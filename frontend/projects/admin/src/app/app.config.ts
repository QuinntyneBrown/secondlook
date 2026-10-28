import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideApi } from 'api';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideApi(environment.apiBaseUrl)],
};

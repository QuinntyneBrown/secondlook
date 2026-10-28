import { ApplicationConfig, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ACCESS_TOKEN, provideApi } from 'api';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { Session } from './session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideApi(environment.apiBaseUrl),
    {
      provide: ACCESS_TOKEN,
      useFactory: () => {
        const session = inject(Session);
        return () => session.token();
      },
    },
  ],
};

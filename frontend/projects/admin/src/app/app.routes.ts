import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { ProvidersPage } from './pages/providers-page';
import { ReadinessPage } from './pages/readiness-page';
import { SignInPage } from './pages/sign-in-page';
import { SystemPage } from './pages/system-page';
import { Session } from './session';

/** Signed-out visitors are sent to sign in. */
const signedIn: CanActivateFn = () =>
  inject(Session).signedIn() || inject(Router).createUrlTree(['/sign-in']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: ReadinessPage },
  { path: 'sign-in', component: SignInPage },
  { path: 'providers', component: ProvidersPage, canActivate: [signedIn] },
  { path: 'forbidden', component: SystemPage, data: { state: 'forbidden' } },
  { path: 'offline', component: SystemPage, data: { state: 'offline' } },
  { path: 'maintenance', component: SystemPage, data: { state: 'maintenance' } },
  { path: '**', component: SystemPage, data: { state: 'not-found' } },
];

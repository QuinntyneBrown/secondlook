import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AvailabilityPage } from './pages/availability-page';
import { BillingPage } from './pages/billing-page';
import { CheckoutPage } from './pages/checkout-page';
import { ForgotPasswordPage } from './pages/forgot-password-page';
import { InspectionsPage } from './pages/inspections-page';
import { ReadinessPage } from './pages/readiness-page';
import { ResetPasswordPage } from './pages/reset-password-page';
import { SignInPage } from './pages/sign-in-page';
import { SignUpPage } from './pages/sign-up-page';
import { SystemPage } from './pages/system-page';
import { VehiclesPage } from './pages/vehicles-page';
import { VerifyEmailPage } from './pages/verify-email-page';
import { Session } from './session';

/** Signed-out visitors are sent to sign in. */
const signedIn: CanActivateFn = () =>
  inject(Session).signedIn() || inject(Router).createUrlTree(['/sign-in']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: ReadinessPage },
  { path: 'sign-up', component: SignUpPage },
  { path: 'sign-in', component: SignInPage },
  { path: 'verify-email', component: VerifyEmailPage },
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },
  { path: 'inspections', component: InspectionsPage, canActivate: [signedIn] },
  { path: 'availability', component: AvailabilityPage, canActivate: [signedIn] },
  { path: 'vehicles', component: VehiclesPage, canActivate: [signedIn] },
  { path: 'checkout', component: CheckoutPage, canActivate: [signedIn] },
  { path: 'billing', component: BillingPage, canActivate: [signedIn] },
  { path: 'forbidden', component: SystemPage, data: { state: 'forbidden' } },
  { path: 'offline', component: SystemPage, data: { state: 'offline' } },
  { path: 'maintenance', component: SystemPage, data: { state: 'maintenance' } },
  { path: '**', component: SystemPage, data: { state: 'not-found' } },
];

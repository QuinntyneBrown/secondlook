import { Routes } from '@angular/router';
import { ReadinessPage } from './pages/readiness-page';
import { SystemPage } from './pages/system-page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: ReadinessPage },
  { path: 'forbidden', component: SystemPage, data: { state: 'forbidden' } },
  { path: 'offline', component: SystemPage, data: { state: 'offline' } },
  { path: 'maintenance', component: SystemPage, data: { state: 'maintenance' } },
  { path: '**', component: SystemPage, data: { state: 'not-found' } },
];

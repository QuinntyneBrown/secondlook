import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type ProviderKind = 'Mechanic' | 'BodyShop';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Deactivated';

export interface Provider {
  id: string;
  kind: ProviderKind;
  displayName: string;
  email: string;
  licenceNumber: string | null;
  location: string | null;
  approvalStatus: ApprovalStatus;
  canTakeInspections: boolean;
}

export interface ProviderFilter {
  status?: ApprovalStatus;
  kind?: ProviderKind;
}

export interface OnboardProvider {
  kind: ProviderKind;
  displayName: string;
  email: string;
  licenceNumber: string;
  location: string;
}

/** Administrator contract for mechanics and body shops. Errors are `ApiProblem`s. */
export interface AdminProvidersApi {
  list(filter?: ProviderFilter): Observable<Provider[]>;
  onboard(provider: OnboardProvider): Observable<Provider>;
  approve(id: string): Observable<void>;
  deactivate(id: string): Observable<void>;
}

export const ADMIN_PROVIDERS_API = new InjectionToken<AdminProvidersApi>('ADMIN_PROVIDERS_API');

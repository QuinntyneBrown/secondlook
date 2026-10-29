import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type FindingStatus = 'Required' | 'Recommended' | 'Passes';
export type IssueReason =
  'FindingLooksWrong' | 'SomethingMissed' | 'CostSeemsOff' | 'SomethingElse';

export interface Finding {
  id: string;
  title: string;
  note: string;
  status: FindingStatus;
  /** The repair cost range in cents; both are null when there is no cost. */
  minCents: number | null;
  maxCents: number | null;
}

/** The body shop's part of the report: NotRequested, NotShared (left out of a shared link), InProgress or Ready. */
export interface BodyShopReview {
  status: 'NotRequested' | 'NotShared' | 'InProgress' | 'Ready';
  reviewerName: string | null;
  findings: Finding[];
}

export interface Report {
  inspectionId: string;
  submittedAt: string;
  callEndedAt: string | null;
  mechanicName: string;
  vin: string;
  odometerKm: number;
  askingPriceCents: number;
  findings: Finding[];
  requiredCount: number;
  /** The certification cost: the Required findings' ranges added up. */
  costMinCents: number;
  costMaxCents: number;
  allInMinCents: number;
  allInMaxCents: number;
  bodyShop: BodyShopReview;
  disclaimer: string;
}

export interface FindingInput {
  title: string;
  note: string;
  status: FindingStatus;
  minCents: number | null;
  maxCents: number | null;
}

export interface ReportShare {
  token: string;
  /** The path of the shared report in the app, such as `/shared/abc`. */
  link: string;
  expiresAt: string;
  includeBodyShop: boolean;
}

/**
 * The safety certification estimate (ADR 0013). Errors are `ApiProblem`s: 404 not on the inspection, 409 not ready
 * (or the call has not ended, for the mechanic), 403 for actions of the other role, 400 for invalid input.
 */
export interface ReportsApi {
  get(inspectionId: string): Observable<Report>;
  /** Mechanic only, after the call: submits the estimate, replacing any earlier one. */
  submit(inspectionId: string, findings: FindingInput[]): Observable<Report>;
  /** Buyer only: the active share link, created if there is none. */
  share(inspectionId: string, includeBodyShop: boolean): Observable<ReportShare>;
  /** Buyer only: emails the active share link. */
  emailShare(inspectionId: string, email: string): Observable<void>;
  /** Buyer only: turns the link off. */
  turnOffShare(inspectionId: string): Observable<void>;
  /** Anyone with a live link, no account. */
  getShared(token: string): Observable<Report>;
  pdf(inspectionId: string): Observable<Blob>;
  reportIssue(inspectionId: string, reason: IssueReason | '', details: string): Observable<void>;
}

export const REPORTS_API = new InjectionToken<ReportsApi>('REPORTS_API');

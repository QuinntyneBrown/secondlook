import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

export type CallStatus = 'NotStarted' | 'Live' | 'Ended';
export type ParticipantRole = 'Buyer' | 'Mechanic' | 'BodyShop' | 'Seller';

export interface CallParticipant {
  userId: string | null;
  name: string;
  role: ParticipantRole;
  /** True while the participant has the call open. */
  here: boolean;
}

export interface ChecklistItem {
  name: string;
  state: 'Done' | 'Now' | 'Next';
}

export interface CallNote {
  author: string;
  text: string;
  at: string;
}

export interface CallState {
  inspectionId: string;
  status: CallStatus;
  start: string;
  /** From this instant the call can be joined. */
  opensAt: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  vin: string;
  you: CallParticipant;
  participants: CallParticipant[];
  checklist: ChecklistItem[];
  notes: CallNote[];
}

/**
 * A live inspection call (ADR 0012). Errors are `ApiProblem`s: 404 not a participant, 409 not open yet,
 * cancelled or not live, 403 for mechanic-only actions.
 */
export interface CallsApi {
  /** The lobby's view; never joins. */
  get(inspectionId: string): Observable<CallState>;
  /** Starts the call if needed (from its opening time) and returns its state. */
  join(inspectionId: string): Observable<CallState>;
  end(inspectionId: string): Observable<CallState>;
  /** Mechanic only: moves the checklist to the next item. */
  advanceChecklist(inspectionId: string): Observable<CallState>;
  /** Mechanic only: adds a note for the others. */
  addNote(inspectionId: string, text: string): Observable<CallState>;
  /** The signalling socket address, carrying the access token (browsers cannot set socket headers). */
  socketUrl(inspectionId: string): string;
}

export const CALLS_API = new InjectionToken<CallsApi>('CALLS_API');

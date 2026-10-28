import { Injectable, signal } from '@angular/core';
import { Hold, ReviewChoice, Vehicle } from 'api';

const KEY = 'secondlook.bookingDraft';

export interface Draft {
  vehicle: Vehicle | null;
  review: ReviewChoice;
  hold: Hold | null;
}

const empty = (): Draft => ({ vehicle: null, review: 'Mechanic', hold: null });

function read(): Draft {
  try {
    return {
      ...empty(),
      ...(JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Partial<Draft> | null),
    };
  } catch {
    return empty();
  }
}

/** The answers of the booking in progress, kept for the tab so a reload does not lose them. */
@Injectable({ providedIn: 'root' })
export class BookingDraft {
  readonly state = signal<Draft>(read());

  update(patch: Partial<Draft>) {
    this.state.update((d) => ({ ...d, ...patch }));
    try {
      sessionStorage.setItem(KEY, JSON.stringify(this.state()));
    } catch {
      // the draft then lasts only for this page view
    }
  }

  /** Starts a new booking: forgets the answers and the idempotency keys of earlier purchase attempts. */
  reset() {
    this.state.set(empty());
    try {
      sessionStorage.removeItem(KEY);
      for (const r of ['Mechanic', 'BodyShop', 'Both'])
        sessionStorage.removeItem(`secondlook.checkoutKey.${r}`);
    } catch {
      // nothing to clear
    }
  }
}

/** One idempotency key per purchase attempt: a reload returns the same checkout, never a second one. */
export function checkoutKey(review: ReviewChoice): string {
  const name = `secondlook.checkoutKey.${review}`;
  try {
    const existing = sessionStorage.getItem(name);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(name, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

import { Injectable, computed, signal } from '@angular/core';

const KEY = 'secondlook.session';

interface Stored {
  token: string;
  displayName: string;
  role?: string;
}

function read(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Stored | null;
  } catch {
    return null;
  }
}

/** The signed-in user. The access token lives in local storage so a reload keeps the session. */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly state = signal<Stored | null>(read());

  readonly signedIn = computed(() => this.state() !== null);
  readonly displayName = computed(() => this.state()?.displayName ?? '');
  readonly role = computed(() => this.state()?.role ?? 'Buyer');

  token(): string | null {
    return this.state()?.token ?? null;
  }

  start(token: string, displayName: string, role = 'Buyer') {
    this.state.set({ token, displayName, role });
    try {
      localStorage.setItem(KEY, JSON.stringify({ token, displayName, role }));
    } catch {
      // storage unavailable: the session lasts until the page closes
    }
  }

  end() {
    this.state.set(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  }
}

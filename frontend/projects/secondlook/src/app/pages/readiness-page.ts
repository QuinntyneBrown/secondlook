import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PLATFORM_API } from 'api';
import { SystemStateKey, SystemStateView } from './system-state-view';

/** The landing screen: proves the shell can reach the API and shows the matching system state when it cannot. */
@Component({
  selector: 'sl-readiness-page',
  imports: [SystemStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (failure(); as key) {
      <sl-system-state-view [key]="key" (retry)="check()" />
    } @else {
      <p role="status" class="status">{{ ready() ? 'The API is ready.' : 'Checking the API…' }}</p>
    }
  `,
  styles: `
    .status {
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      color: var(--colorNeutralForeground1);
      font-family: var(--fontFamilyBase);
      text-align: center;
    }
  `,
})
export class ReadinessPage {
  private readonly api = inject(PLATFORM_API);
  protected readonly ready = signal(false);
  protected readonly failure = signal<SystemStateKey | null>(null);

  constructor() {
    this.check();
  }

  check() {
    this.ready.set(false);
    this.failure.set(null);
    this.api.ready().subscribe({
      next: () => this.ready.set(true),
      error: (e: unknown) => this.failure.set(this.stateFor(e)),
    });
  }

  /** No connection at all is offline, 503 is maintenance, anything else is our fault. */
  private stateFor(e: unknown): SystemStateKey {
    const status = e instanceof HttpErrorResponse ? e.status : -1;
    if (status === 0 && !navigator.onLine) return 'offline';
    return status === 503 ? 'maintenance' : 'server-error';
  }
}

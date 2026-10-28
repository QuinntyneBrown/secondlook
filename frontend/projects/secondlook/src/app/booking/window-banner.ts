import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PricingWindow } from 'api';
import { Button } from 'components';
import { dayChip } from '../util/eastern-time';

const KEY = 'secondlook.windowBannerDismissed';

/** The pricing window banner (L2-034): open, closing soon (dismissible) or closed (not dismissible). */
@Component({
  selector: 'sl-window-banner',
  imports: [Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown(); as w) {
      <section class="banner" aria-label="Pricing window" [class.closed]="w.state === 'Closed'">
        <div class="text">
          @switch (w.state) {
            @case ('Open') {
              <strong>Your window is open until {{ endDay(w) }}</strong>
              <span>Add another car to compare for $25 each.</span>
            }
            @case ('ClosingSoon') {
              <strong>Your window closes in {{ w.daysRemaining }} days</strong>
              <span>Add a car by {{ endDay(w) }} to keep the $25 price.</span>
            }
            @default {
              <strong>Your window has closed</strong>
              <span>
                A new inspection is $50 and starts a new window. Your reports stay in your account.
              </span>
            }
          }
        </div>
        <div class="actions">
          @if (w.state === 'Closed') {
            <sl-button routerLink="/book/vehicle">Book an inspection</sl-button>
          } @else {
            <sl-button (pressed)="add.emit()">Add another car · $25</sl-button>
          }
          @if (w.state === 'ClosingSoon') {
            <sl-button variant="outline" (pressed)="dismiss()">Dismiss</sl-button>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacingHorizontalL);
      margin-bottom: var(--spacingVerticalL);
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border-radius: var(--borderRadiusLarge);
      background: var(--colorBrandBackground2, var(--colorNeutralBackground3));
      color: var(--colorNeutralForeground1);
    }
    .banner.closed {
      background: var(--colorNeutralBackground3);
    }
    .text {
      display: grid;
      gap: 2px;
    }
    .actions {
      display: flex;
      gap: var(--spacingHorizontalS);
    }
  `,
})
export class WindowBanner {
  /** The server's window; "None" shows nothing. */
  readonly window = input.required<PricingWindow | null>();
  readonly add = output<void>();

  private readonly dismissed = signal(WindowBanner.wasDismissed());

  protected shown(): PricingWindow | null {
    const w = this.window();
    if (!w || w.state === 'None') return null;
    // Only the closing-soon banner can be dismissed, and only for the end date it was shown for.
    if (w.state === 'ClosingSoon' && this.dismissed() === w.endsAt) return null;
    return w;
  }

  protected endDay(w: PricingWindow) {
    return w.endsAt ? dayChip(w.endsAt) : '';
  }

  protected dismiss() {
    const ends = this.window()?.endsAt ?? null;
    this.dismissed.set(ends);
    try {
      if (ends) localStorage.setItem(KEY, ends);
    } catch {
      // the banner returns on the next visit
    }
  }

  private static wasDismissed(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
}

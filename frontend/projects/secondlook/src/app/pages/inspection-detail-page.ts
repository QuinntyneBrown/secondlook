import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BOOKINGS_API, Inspection } from 'api';
import { Alert, Button } from 'components';
import { BuyerNav } from '../booking/booking-chrome';
import { CancelInspectionDialog } from '../dialogs/cancel-inspection-dialog';
import { RescheduleDialog } from '../dialogs/reschedule-dialog';
import { callTime, dayLabel } from '../util/eastern-time';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const whole = (cents: number) => `$${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

/** One inspection (L2-035, L2-036 to L2-038): its details, and the ways to move or cancel it. */
@Component({
  selector: 'sl-inspection-detail-page',
  imports: [Alert, Button, BuyerNav, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page" [attr.aria-busy]="inspection() || failed() ? null : 'true'">
      @if (inspection(); as i) {
        <h1>{{ i.vehicle.vin }}</h1>
        <p class="sub">Booked {{ booked(i) }}</p>

        @if (toast(); as t) {
          <sl-alert
            variant="success"
            [title]="'Rescheduled to ' + t.when"
            [text]="t.seller + ' has a new text with the time.'"
          >
            <sl-button variant="outline" (pressed)="undo()">Undo</sl-button>
          </sl-alert>
        }
        @if (undoFailed()) {
          <sl-alert
            title="We couldn’t undo that"
            text="That earlier time is no longer free. Your call is still booked."
          />
        }

        @if (i.status === 'Cancelled') {
          <p class="status">Cancelled · refunded {{ whole(i.refundedCents) }}</p>
          <sl-alert
            title="Cancelled on {{ cancelledOn(i) }}"
            [text]="
              'We refunded ' +
              money(i.refundedCents) +
              ' to the card ending ' +
              i.cardLast4 +
              '. Rebook any time; your answers are saved.'
            "
          >
            <a routerLink="/book/vehicle">Rebook this car</a>
          </sl-alert>
        } @else {
          <p class="status">Scheduled · {{ callTime(i) }}</p>
        }

        <dl>
          <dt>Odometer</dt>
          <dd>{{ i.vehicle.odometerKm.toLocaleString('en-CA') }} km</dd>
          <dt>Asking price</dt>
          <dd>{{ '$' + i.vehicle.askingPrice.toLocaleString('en-CA') }}</dd>
          <dt>Reviews</dt>
          <dd>{{ reviews(i) }}</dd>
          <dt>Seller</dt>
          <dd>{{ i.vehicle.sellerName }} · {{ i.vehicle.sellerPhone }}</dd>
        </dl>
        <section aria-labelledby="team">
          <h2 id="team">Your team</h2>
          @if (i.mechanicName) {
            <p>{{ i.mechanicName }} · Mechanic</p>
          }
          @if (i.bodyShopName) {
            <p>{{ i.bodyShopName }} · Body shop</p>
          }
        </section>
        <section aria-labelledby="paid">
          <h2 id="paid">Paid</h2>
          <p>Paid {{ money(i.amountCents) }}</p>
        </section>

        @if (i.status !== 'Cancelled') {
          <div class="actions">
            <sl-button [routerLink]="'/inspections/' + i.id + '/lobby'">Join the call</sl-button>
            <sl-button variant="outline" [routerLink]="'/inspections/' + i.id + '/report'"
              >View report</sl-button
            >
          </div>
        }
        @if (i.canChange) {
          <div class="actions">
            <sl-button variant="outline" (pressed)="reschedule(i)">Reschedule</sl-button>
            <sl-button variant="outline" (pressed)="cancel(i)">Cancel inspection</sl-button>
          </div>
          <p class="hint">The call opens 15 minutes before the start time.</p>
        }
        <a routerLink="/inspections">All inspections</a>
      } @else if (failed()) {
        <sl-alert
          title="We couldn’t load this inspection"
          text="It’s still booked. Try again in a moment."
        >
          <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
          <a routerLink="/inspections">All inspections</a>
        </sl-alert>
      } @else {
        <p role="status">Loading this inspection…</p>
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    .page {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(640px, 100%);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub,
    .hint {
      color: var(--colorNeutralForeground2);
    }
    .status {
      font-weight: var(--fontWeightSemibold);
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--spacingVerticalS) var(--spacingHorizontalXXL);
      margin: 0;
    }
    dd {
      margin: 0;
    }
    .actions {
      display: flex;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class InspectionDetailPage {
  private readonly api = inject(BOOKINGS_API);
  private readonly dialog = inject(Dialog);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly money = money;
  protected readonly whole = whole;
  protected readonly callTime = (i: Inspection) => callTime(i.start);
  protected readonly booked = (i: Inspection) => dayLabel(i.createdAt);
  protected readonly cancelledOn = (i: Inspection) =>
    i.cancelledAt ? dayLabel(i.cancelledAt) : '';
  protected readonly inspection = signal<Inspection | null>(null);
  protected readonly failed = signal(false);
  protected readonly toast = signal<{ when: string; seller: string } | null>(null);
  protected readonly undoFailed = signal(false);
  private before: string | null = null;

  constructor() {
    this.load();
  }

  protected reviews(i: Inspection) {
    return i.review === 'Both'
      ? 'Mechanic + body shop'
      : i.review === 'BodyShop'
        ? 'Body shop'
        : 'Mechanic';
  }

  protected load() {
    this.failed.set(false);
    this.api.inspection(this.id).subscribe({
      next: (i) => this.inspection.set(i),
      error: () => this.failed.set(true),
    });
  }

  protected reschedule(i: Inspection) {
    const ref = this.dialog.open<Inspection>(RescheduleDialog, {
      data: { inspection: i },
      ariaLabelledBy: 'reschedule-title',
      ariaDescribedBy: 'reschedule-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((moved) => {
      if (!moved) return;
      this.before = i.start;
      this.undoFailed.set(false);
      this.inspection.set(moved);
      this.toast.set({ when: callTime(moved.start), seller: moved.vehicle.sellerName });
    });
  }

  /** Undo is a reschedule back to the original time; it works while that time is still free. */
  protected undo() {
    const previous = this.before;
    if (!previous) return;
    this.api.reschedule(this.id, previous).subscribe({
      next: (i) => {
        this.toast.set(null);
        this.before = null;
        this.inspection.set(i);
      },
      error: () => {
        this.toast.set(null);
        this.undoFailed.set(true);
      },
    });
  }

  protected cancel(i: Inspection) {
    const ref = this.dialog.open<Inspection | false>(CancelInspectionDialog, {
      data: { inspection: i },
      // "Keep inspection" is the safe action and takes focus when the dialog opens.
      autoFocus: '[data-keep] button',
      ariaLabelledBy: 'cancel-title',
      ariaDescribedBy: 'cancel-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((cancelled) => {
      if (cancelled) {
        this.toast.set(null);
        this.inspection.set(cancelled);
      }
    });
  }
}

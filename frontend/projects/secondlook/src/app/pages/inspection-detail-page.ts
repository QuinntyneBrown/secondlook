import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BOOKINGS_API, Inspection } from 'api';
import { Alert, Button } from 'components';
import { BuyerNav } from '../booking/booking-chrome';
import { callTime, dayLabel } from '../util/eastern-time';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** One inspection (L2-035): the vehicle details it was booked with, the time, the team and what was paid. */
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
        <p class="status">Scheduled · {{ callTime(i) }}</p>
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
          <p>{{ i.mechanicName }} · Mechanic</p>
        </section>
        <section aria-labelledby="paid">
          <h2 id="paid">Paid</h2>
          <p>Paid {{ money(i.amountCents) }}</p>
        </section>
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
    .sub {
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
  `,
})
export class InspectionDetailPage {
  private readonly api = inject(BOOKINGS_API);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly money = money;
  protected readonly callTime = (i: Inspection) => callTime(i.start);
  protected readonly booked = (i: Inspection) => dayLabel(i.createdAt);
  protected readonly inspection = signal<Inspection | null>(null);
  protected readonly failed = signal(false);

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
}

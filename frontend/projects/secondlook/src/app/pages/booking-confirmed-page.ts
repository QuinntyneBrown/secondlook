import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BOOKINGS_API, Inspection, vehicleName } from 'api';
import { Alert, Button } from 'components';
import { callTime, longWeekday, timeLabel } from '../util/eastern-time';
import { providerNames } from '../util/providers';

/** The booking confirmation (L2-035's sibling mock "booking-confirmed"). */
@Component({
  selector: 'sl-booking-confirmed-page',
  imports: [Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      @if (inspection(); as i) {
        <h1>You’re booked for {{ weekday(i) }} at {{ time(i) }}</h1>
        <p class="lead">
          {{ names(i) }} will inspect the car over video. Your estimate lands within an hour of the
          call.
        </p>
        <section aria-labelledby="next">
          <h2 id="next">What happens next</h2>
          <ol>
            <li>
              <strong>Booked and paid</strong> {{ '$' + (i.amountCents / 100).toFixed(2) }} for
              {{ name(i) }}.
            </li>
            <li>
              <strong>We text {{ i.vehicle.sellerName }}</strong> They get a link to join, and a
              reminder an hour before.
            </li>
            <li>
              <strong>Video call, {{ callTime(i) }}</strong> Join from this page. About 20 minutes.
            </li>
            <li><strong>Your report</strong> A findings list and a cost range, inside an hour.</li>
          </ol>
        </section>
        <div class="actions">
          <a routerLink="/book/vehicle">Add another car</a>
          <a [routerLink]="['/inspections', i.id]">View inspection</a>
        </div>
      } @else if (failed()) {
        <sl-alert
          title="We couldn’t load your booking"
          text="It’s still booked. Try again in a moment."
        >
          <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
        </sl-alert>
      } @else {
        <p role="status">Loading your booking…</p>
      }
    </main>
  `,
  styles: `
    .page {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(640px, 100%);
      margin: 0 auto;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .lead {
      color: var(--colorNeutralForeground2);
    }
    ol {
      display: grid;
      gap: var(--spacingVerticalM);
      margin: var(--spacingVerticalS) 0 0;
      padding-left: var(--spacingHorizontalXXL);
    }
    .actions {
      display: flex;
      gap: var(--spacingHorizontalL);
    }
  `,
})
export class BookingConfirmedPage {
  protected readonly names = providerNames;
  protected readonly name = (i: Inspection) => vehicleName(i.vehicle);
  private readonly api = inject(BOOKINGS_API);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly inspection = signal<Inspection | null>(null);
  protected readonly failed = signal(false);
  protected readonly weekday = (i: Inspection) => longWeekday(i.start);
  protected readonly time = (i: Inspection) => timeLabel(i.start);
  protected readonly callTime = (i: Inspection) => callTime(i.start);

  constructor() {
    this.load();
  }

  protected load() {
    this.failed.set(false);
    this.api.inspection(this.id).subscribe({
      next: (i) => this.inspection.set(i),
      error: () => this.failed.set(true),
    });
  }
}

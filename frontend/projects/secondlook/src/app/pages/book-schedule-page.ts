import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiProblem, BOOKINGS_API, Checkout, PAYMENTS_API, Slot, vehicleName } from 'api';
import { Alert, Button } from 'components';
import { BookingDraft, checkoutKey } from '../booking/booking-draft';
import { BookingSteps, BuyerNav, OrderSummary } from '../booking/booking-chrome';
import { dayChip, longWeekday, timeLabel } from '../util/eastern-time';

type View = 'loading' | 'ready' | 'failed';

/** Step 3 of booking (L2-025): pick a real free slot, then hold it for 10 minutes. */
@Component({
  selector: 'sl-book-schedule-page',
  imports: [Alert, Button, BookingSteps, BuyerNav, OrderSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page">
      <h1>Book an inspection</h1>
      <p class="lead">Choose a time. The seller joins from a text link.</p>
      <sl-booking-steps [current]="2" />
      <div class="layout">
        <section aria-labelledby="when">
          <h2 id="when">When can the seller be with the car?</h2>

          @if (taken()) {
            <sl-alert
              title="We couldn’t hold that slot"
              text="Someone just took it. Pick another time and you won’t lose your answers."
            >
              <sl-button variant="outline" (pressed)="chooseAnotherTime()"
                >Choose another time</sl-button
              >
            </sl-alert>
          }
          @if (view() === 'loading') {
            <p role="status">Finding mechanics near Hamilton…</p>
          } @else if (view() === 'failed') {
            <sl-alert
              title="We couldn’t load time slots"
              text="Check your connection and try again. Your answers so far are saved."
            >
              <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
            </sl-alert>
          } @else if (days().length === 0) {
            <div class="none">
              @if (review() === 'Both') {
                <h3>No shared times yet</h3>
                <p>
                  No time has both a mechanic and a body shop free. Go back and choose a single
                  review.
                </p>
              } @else {
                <h3>
                  {{ review() === 'BodyShop' ? 'No body shops free yet' : 'No mechanics free yet' }}
                </h3>
                <p>
                  Everyone near Hamilton is booked. Check back soon, or try another review type.
                </p>
              }
            </div>
          } @else {
            <div class="chips" role="group" aria-label="Day">
              @for (d of days(); track d.chip) {
                <button
                  type="button"
                  class="chip"
                  [attr.aria-pressed]="d.chip === dayChoice()"
                  (click)="pickDay(d.chip)"
                >
                  {{ d.chip }}
                </button>
              }
            </div>
            @if (selectedDay(); as day) {
              <h3>{{ day.long }}</h3>
              <div class="chips" role="group" aria-label="Time">
                @for (s of day.slots; track s.start) {
                  <button
                    type="button"
                    class="chip"
                    [attr.aria-pressed]="s.start === slot()?.start"
                    (click)="pickSlot(s)"
                  >
                    {{ time(s) }}
                  </button>
                }
              </div>
            }
            @if (slot(); as chosen) {
              @if (review() !== 'BodyShop') {
                <div class="mechanic">
                  <strong>{{ chosen.providerName }}</strong>
                  <span>Licensed mechanic near Hamilton</span>
                </div>
              }
              @if (review() === 'Both' && chosen.bodyShopName) {
                <div class="mechanic">
                  <strong>{{ chosen.bodyShopName }}</strong>
                  <span>Body shop reviewer near Hamilton</span>
                </div>
              } @else if (review() === 'BodyShop') {
                <div class="mechanic">
                  <strong>{{ chosen.providerName }}</strong>
                  <span>Body shop reviewer near Hamilton</span>
                </div>
              }
            }
          }
          <div class="actions">
            <sl-button variant="outline" (pressed)="back()">Back</sl-button>
            <sl-button [disabled]="!slot()" [busy]="busy()" (pressed)="hold()">{{
              busy() ? 'Holding your slot' : 'Continue to payment'
            }}</sl-button>
          </div>
        </section>
        <sl-order-summary
          [vehicle]="vehicleLabel()"
          [lines]="checkout()?.quote?.lines ?? []"
          [total]="checkout()?.quote?.totalCents ?? 0"
        />
      </div>
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
      width: min(880px, 100%);
      margin: 0 auto;
    }
    h1,
    h2,
    h3,
    p {
      margin: 0;
    }
    .lead {
      color: var(--colorNeutralForeground2);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: var(--spacingHorizontalXXL);
      align-items: start;
    }
    section {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalS);
    }
    .chip {
      min-height: 40px;
      padding: 0 var(--spacingHorizontalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke1);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font: inherit;
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      border-color: var(--colorBrandStroke1);
      background: var(--colorBrandBackground);
      color: var(--colorNeutralForegroundOnBrand);
    }
    .mechanic {
      display: grid;
      padding: var(--spacingVerticalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .actions {
      display: flex;
      justify-content: space-between;
    }
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class BookSchedulePage {
  private readonly bookings = inject(BOOKINGS_API);
  private readonly payments = inject(PAYMENTS_API);
  private readonly draft = inject(BookingDraft);
  private readonly router = inject(Router);

  protected readonly view = signal<View>('loading');
  protected readonly slots = signal<Slot[]>([]);
  protected readonly dayChoice = signal<string | null>(null);
  protected readonly slot = signal<Slot | null>(null);
  protected readonly busy = signal(false);
  protected readonly taken = signal(false);
  protected readonly checkout = signal<Checkout | null>(null);
  protected readonly time = (s: Slot) => timeLabel(s.start);
  protected readonly review = computed(() => this.draft.state().review);

  /** Slots grouped by day, one slot per start time. */
  protected readonly days = computed(() => {
    const map = new Map<string, { chip: string; long: string; slots: Slot[] }>();
    for (const s of this.slots()) {
      const chip = dayChip(s.start);
      const day = map.get(chip) ?? { chip, long: longWeekday(s.start), slots: [] };
      if (!day.slots.some((x) => x.start === s.start)) day.slots.push(s);
      map.set(chip, day);
    }
    return [...map.values()];
  });
  protected readonly selectedDay = computed(
    () => this.days().find((d) => d.chip === this.dayChoice()) ?? null,
  );

  constructor() {
    const draft = this.draft.state();
    if (!draft.vehicle) void this.router.navigateByUrl('/book/vehicle');
    else {
      this.payments
        .createCheckout(draft.review, checkoutKey(draft.review), draft.vehicle.id)
        .subscribe({
          next: (c) => this.checkout.set(c),
          error: () => undefined,
        });
      this.load();
    }
  }

  protected vehicleLabel() {
    const d = this.draft.state();
    return d.vehicle
      ? `${vehicleName(d.vehicle)} · ${d.review === 'Both' ? 'Mechanic + body shop' : d.review === 'BodyShop' ? 'Body shop' : 'Mechanic'}`
      : null;
  }

  protected load() {
    this.view.set('loading');
    this.slot.set(null);
    this.bookings
      .slots(this.draft.state().review === 'Mechanic' ? 'Mechanic' : this.draft.state().review)
      .subscribe({
        next: (slots) => {
          this.slots.set(slots);
          this.dayChoice.set(this.days()[0]?.chip ?? null);
          this.view.set('ready');
        },
        error: () => this.view.set('failed'),
      });
  }

  protected pickDay(chip: string) {
    this.dayChoice.set(chip);
    this.slot.set(null);
  }

  protected pickSlot(s: Slot) {
    this.taken.set(false);
    this.slot.set(s);
  }

  protected chooseAnotherTime() {
    this.taken.set(false);
    this.load();
  }

  protected hold() {
    const s = this.slot();
    if (!s || this.busy()) return;
    this.busy.set(true);
    this.taken.set(false);
    this.bookings.hold(s.providerId, s.start, s.bodyShopId).subscribe({
      next: (hold) => {
        this.draft.update({ hold });
        void this.router.navigate(['/checkout'], {
          queryParams: { review: this.draft.state().review },
        });
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        if (p.status === 409) this.taken.set(true);
        else this.view.set('failed');
      },
    });
  }

  protected back() {
    void this.router.navigateByUrl('/book/review');
  }
}

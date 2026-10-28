import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Checkout, PAYMENTS_API, ReviewChoice } from 'api';
import { Alert, Button } from 'components';
import { BookingDraft, checkoutKey } from '../booking/booking-draft';
import { BookingSteps, BuyerNav, OrderSummary } from '../booking/booking-chrome';

/** Step 2 of booking (L2-024): which review, with the server's price beside it. */
@Component({
  selector: 'sl-book-review-page',
  imports: [Alert, Button, BookingSteps, BuyerNav, OrderSummary],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page">
      <h1>Book an inspection</h1>
      <p class="lead">Pick the review that fits the car.</p>
      <sl-booking-steps [current]="1" />
      <div class="layout">
        <form (submit)="submit($event)">
          <fieldset>
            <legend>What should we look at?</legend>
            @for (o of options; track o.value) {
              <label class="option">
                <input
                  type="radio"
                  name="review"
                  [value]="o.value"
                  [checked]="review() === o.value"
                  (change)="choose(o.value)"
                />
                <span>
                  <strong>{{ o.label }}</strong>
                  <small>{{ o.hint }}</small>
                </span>
              </label>
            }
          </fieldset>
          @if (failed()) {
            <sl-alert
              title="We couldn’t price that review"
              text="Check your connection and try again. Your answers are saved."
            >
              <sl-button variant="outline" (pressed)="choose(review())">Try again</sl-button>
            </sl-alert>
          }
          <div class="actions">
            <sl-button variant="outline" (pressed)="back()">Back</sl-button>
            <sl-button type="submit" [disabled]="!checkout()">Continue to scheduling</sl-button>
          </div>
        </form>
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
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    fieldset {
      display: grid;
      gap: var(--spacingVerticalM);
      border: 0;
      padding: 0;
    }
    .option {
      display: flex;
      gap: var(--spacingHorizontalM);
      padding: var(--spacingVerticalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .option span {
      display: grid;
    }
    small {
      color: var(--colorNeutralForeground3);
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
export class BookReviewPage {
  private readonly draft = inject(BookingDraft);
  private readonly payments = inject(PAYMENTS_API);
  private readonly router = inject(Router);

  protected readonly options: { value: ReviewChoice; label: string; hint: string }[] = [
    { value: 'Mechanic', label: 'Mechanic', hint: 'Safety certification estimate' },
    { value: 'BodyShop', label: 'Body shop', hint: 'Rust, paint and panel damage' },
    { value: 'Both', label: 'Both', hint: '+$20 · Mechanical and body in one call' },
  ];

  protected readonly review = signal<ReviewChoice>(this.draft.state().review);
  protected readonly checkout = signal<Checkout | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    if (!this.draft.state().vehicle) void this.router.navigateByUrl('/book/vehicle');
    else this.choose(this.review());
  }

  protected vehicleLabel() {
    const v = this.draft.state().vehicle;
    return v
      ? `${v.vin} · ${this.review() === 'Both' ? 'Mechanic + body shop' : this.review() === 'BodyShop' ? 'Body shop' : 'Mechanic'}`
      : null;
  }

  /** The quote comes from the server: choosing a review (re)creates the same idempotent checkout and reads its price. */
  protected choose(review: ReviewChoice) {
    this.review.set(review);
    this.failed.set(false);
    this.checkout.set(null);
    const vehicle = this.draft.state().vehicle;
    this.payments.createCheckout(review, checkoutKey(review), vehicle?.id).subscribe({
      next: (c) => this.checkout.set(c),
      error: () => this.failed.set(true),
    });
  }

  protected submit(event: Event) {
    event.preventDefault();
    if (!this.checkout()) return;
    this.draft.update({ review: this.review() });
    void this.router.navigateByUrl('/book/schedule');
  }

  protected back() {
    void this.router.navigateByUrl('/book/vehicle');
  }
}

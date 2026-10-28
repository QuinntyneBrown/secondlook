import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuoteLine } from 'api';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** The four booking steps (L2-023). */
@Component({
  selector: 'sl-booking-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol aria-label="Booking steps">
      @for (s of steps; track s; let i = $index) {
        <li [attr.aria-current]="i === current() ? 'step' : null" [class.done]="i < current()">
          {{ s }}
        </li>
      }
    </ol>
  `,
  styles: `
    ol {
      display: flex;
      gap: var(--spacingHorizontalL);
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--colorNeutralForeground3);
    }
    li[aria-current='step'] {
      color: var(--colorBrandForeground1);
      font-weight: var(--fontWeightSemibold);
    }
    li.done {
      color: var(--colorNeutralForeground2);
    }
  `,
})
export class BookingSteps {
  protected readonly steps = ['Vehicle', 'Review', 'Schedule', 'Pay'];
  /** Zero-based index of the current step. */
  readonly current = input.required<number>();
}

/** "Your order": the vehicle, the server's price lines and the total. */
@Component({
  selector: 'sl-order-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-label="Your order">
      <h2>Your order</h2>
      @if (vehicle()) {
        <p class="vehicle">{{ vehicle() }}</p>
      }
      @if (lines().length) {
        <ul>
          @for (l of lines(); track l.label) {
            <li>{{ l.label }} {{ money(l.cents) }}</li>
          }
        </ul>
        <p class="total">Total {{ money(total()) }}</p>
      } @else {
        <p class="vehicle">Choose a review to see the price.</p>
      }
    </section>
  `,
  styles: `
    section {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusLarge);
      background: var(--colorNeutralBackground1);
    }
    h2,
    p {
      margin: 0;
    }
    ul {
      margin: 0;
      padding-left: var(--spacingHorizontalXXL);
    }
    .vehicle {
      color: var(--colorNeutralForeground2);
    }
    .total {
      font-weight: var(--fontWeightSemibold);
    }
  `,
})
export class OrderSummary {
  protected readonly money = money;
  readonly vehicle = input<string | null>(null);
  readonly lines = input<QuoteLine[]>([]);
  readonly total = input(0);
}

/** The signed-in buyer's primary navigation. */
@Component({
  selector: 'sl-buyer-nav',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Primary">
      <a routerLink="/inspections">Inspections</a>
      <a routerLink="/vehicles">Vehicles</a>
      <a routerLink="/billing">Billing</a>
    </nav>
  `,
  styles: `
    nav {
      display: flex;
      gap: var(--spacingHorizontalL);
      margin-bottom: var(--spacingVerticalL);
    }
  `,
})
export class BuyerNav {}

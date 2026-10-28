import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiProblem, Checkout, PAYMENTS_API, ReviewChoice } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const payLabel = (cents: number) =>
  `Pay $${cents % 100 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`;

/** The Pay step (L2-028): a server-priced order and a card form whose details go to the processor, not to us. */
@Component({
  selector: 'sl-checkout-page',
  imports: [Alert, Button, FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Pay now</h1>
      <p class="lead">Pay now. If the seller doesn’t join, you’re refunded in full.</p>

      @if (loadFailed()) {
        <sl-alert
          title="We couldn’t load your order"
          text="Your answers are saved. Check your connection and try again."
        >
          <sl-button variant="outline" (pressed)="start()">Try again</sl-button>
        </sl-alert>
      } @else if (checkout(); as c) {
        <section class="order" aria-label="Your order">
          <h2>Your order</h2>
          <ul>
            @for (l of c.quote.lines; track l.label) {
              <li>{{ l.label }} {{ money(l.cents) }}</li>
            }
          </ul>
          <p class="total">Total {{ money(c.quote.totalCents) }}</p>
        </section>

        @if (paid(); as p) {
          <sl-alert variant="success" title="Payment received" [text]="p">
            <a routerLink="/billing">View billing history</a>
          </sl-alert>
        } @else {
          <form novalidate (submit)="submit($event)">
            <h2>Pay with card</h2>
            @if (summary().length) {
              <sl-alert
                [title]="
                  'Fix ' +
                  summary().length +
                  (summary().length === 1 ? ' thing' : ' things') +
                  ' to pay'
                "
                [items]="summary()"
                [focusOnShow]="true"
              />
            }
            @if (declined(); as d) {
              <sl-alert title="Your card was declined" [text]="d">
                <sl-button variant="outline" (pressed)="addDifferentCard()"
                  >Add a different card</sl-button
                >
              </sl-alert>
            }
            @if (approval(); as a) {
              <sl-alert variant="info" title="Confirm with your bank" [text]="a" />
            }
            @if (failed()) {
              <sl-alert
                title="We couldn’t take that payment"
                text="Something went wrong on our side. You haven’t been charged. Try again."
              />
            }
            <sl-form-field
              fieldId="card-number"
              label="Card number"
              autocomplete="cc-number"
              [error]="errors()['card-number']"
              [readonly]="busy()"
              [(value)]="number"
            />
            <sl-form-field
              fieldId="expiry"
              label="Expiry"
              autocomplete="cc-exp"
              [error]="errors()['expiry']"
              [readonly]="busy()"
              [(value)]="expiry"
            />
            <sl-form-field
              fieldId="security"
              label="Security code"
              autocomplete="cc-csc"
              [error]="errors()['security']"
              [readonly]="busy()"
              [(value)]="security"
            />
            <sl-form-field
              fieldId="card-name"
              label="Name on card"
              autocomplete="cc-name"
              [error]="errors()['card-name']"
              [readonly]="busy()"
              [(value)]="name"
            />
            <sl-form-field
              fieldId="postal"
              label="Postal code"
              autocomplete="postal-code"
              [error]="errors()['postal']"
              [readonly]="busy()"
              [(value)]="postal"
            />
            <label class="choice">
              <input
                type="checkbox"
                id="told-seller"
                [checked]="told()"
                (change)="told.set($any($event.target).checked)"
              />
              <span>I’ve told the seller about the video call and they’re happy to take part.</span>
            </label>
            <div class="actions">
              <sl-button variant="outline" (pressed)="goBack()">Back</sl-button>
              <sl-button type="submit" [busy]="busy()">{{
                busy() ? 'Paying' : payLabel(c.quote.totalCents)
              }}</sl-button>
            </div>
          </form>
        }
      }
    </main>
  `,
  styles: `
    .page {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(520px, 100%);
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
    .order {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusLarge);
    }
    ul {
      margin: 0;
      padding-left: var(--spacingHorizontalXXL);
    }
    .total {
      font-weight: var(--fontWeightSemibold);
    }
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    .choice {
      display: flex;
      gap: var(--spacingHorizontalS);
      align-items: start;
    }
    .actions {
      display: flex;
      justify-content: space-between;
    }
  `,
})
export class CheckoutPage {
  private readonly api = inject(PAYMENTS_API);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly money = money;
  protected readonly payLabel = payLabel;

  private readonly review: ReviewChoice = (['Mechanic', 'BodyShop', 'Both'] as const).includes(
    this.route.snapshot.queryParamMap.get('review') as ReviewChoice,
  )
    ? (this.route.snapshot.queryParamMap.get('review') as ReviewChoice)
    : 'Mechanic';

  protected readonly checkout = signal<Checkout | null>(null);
  protected readonly loadFailed = signal(false);
  protected readonly number = signal('');
  protected readonly expiry = signal('');
  protected readonly security = signal('');
  protected readonly name = signal('');
  protected readonly postal = signal('');
  protected readonly told = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly declined = signal<string | null>(null);
  protected readonly approval = signal<string | null>(null);
  protected readonly paid = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  constructor() {
    this.start();
  }

  private get keyName() {
    return `secondlook.checkoutKey.${this.review}`;
  }

  /** One idempotency key per purchase attempt: reloading the page returns the same checkout, never a second one. */
  protected start() {
    this.loadFailed.set(false);
    let key: string | null = null;
    try {
      key = sessionStorage.getItem(this.keyName);
    } catch {
      // fall through with a fresh key
    }
    if (!key) {
      key = crypto.randomUUID();
      try {
        sessionStorage.setItem(this.keyName, key);
      } catch {
        // the key then lasts only for this page view
      }
    }
    this.api.createCheckout(this.review, key).subscribe({
      next: (c) => {
        this.checkout.set(c);
        if (c.status === 'Paid')
          this.paid.set('This inspection is already paid. Your receipt is in billing history.');
      },
      error: () => this.loadFailed.set(true),
    });
  }

  protected addDifferentCard() {
    this.number.set('');
    this.expiry.set('');
    this.security.set('');
    this.declined.set(null);
    queueMicrotask(() => document.getElementById('card-number')?.focus());
  }

  protected submit(event: Event) {
    event.preventDefault();
    const c = this.checkout();
    if (!c || this.busy()) return;
    this.declined.set(null);
    this.approval.set(null);
    this.failed.set(false);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    const add = (id: string, message: string) => {
      errors[id] = message;
      items.push({ message, fieldId: id });
    };
    if (this.number().replace(/\D/g, '').length !== 16)
      add('card-number', 'Enter the 16 digits on the front of your card.');
    if (!/^(0[1-9]|1[0-2])\s*\/?\s*\d{2}$/.test(this.expiry().trim()))
      add('expiry', 'That expiry date isn’t valid.');
    if (!/^\d{3}$/.test(this.security().trim()))
      add('security', 'Enter the 3-digit security code.');
    if (!this.name().trim()) add('card-name', 'Enter the name on the card.');
    if (!this.postal().trim()) add('postal', 'Enter your postal code.');
    if (!items.length && !this.told())
      items.push({
        message: 'Confirm you’ve told the seller about the video call.',
        fieldId: 'told-seller',
      });
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    this.api
      .tokenize({
        cardNumber: this.number(),
        expiry: this.expiry(),
        securityCode: this.security(),
        nameOnCard: this.name(),
        postalCode: this.postal(),
      })
      .subscribe({
        next: (token) =>
          this.api.pay(c.id, token.token).subscribe({
            next: (outcome) => {
              this.busy.set(false);
              if (outcome.status === 'RequiresAction') {
                this.approval.set(outcome.message);
                return;
              }
              try {
                sessionStorage.removeItem(this.keyName);
              } catch {
                // nothing to clear
              }
              this.paid.set(
                `You paid ${money(outcome.amountCents)} with ${outcome.cardBrand} ending ${outcome.cardLast4}. Your receipt is in billing history.`,
              );
            },
            error: (p: ApiProblem) => {
              this.busy.set(false);
              if (p.status === 402)
                this.declined.set(
                  p.detail ?? 'Your bank didn’t approve this payment. You haven’t been charged.',
                );
              else this.failed.set(true);
            },
          }),
        error: (p: ApiProblem) => {
          this.busy.set(false);
          if (p.status === 400 && p.errors) {
            const mapped: Record<string, string> = {};
            const server: SummaryItem[] = [];
            for (const [field, id] of [
              ['cardNumber', 'card-number'],
              ['expiry', 'expiry'],
              ['securityCode', 'security'],
              ['nameOnCard', 'card-name'],
              ['postalCode', 'postal'],
            ] as const) {
              const message = p.errors[field]?.[0];
              if (message) {
                mapped[id] = message;
                server.push({ message, fieldId: id });
              }
            }
            this.errors.set(mapped);
            queueMicrotask(() => this.summary.set(server));
          } else this.failed.set(true);
        },
      });
  }

  protected goBack() {
    void this.router.navigateByUrl('/inspections');
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { PAYMENTS_API, PricingWindow, ReviewChoice } from 'api';
import { Alert, Button } from 'components';
import { dayLabel } from '../util/eastern-time';

export interface AddAnotherData {
  window: PricingWindow;
}

export interface AddAnotherResult {
  vin: string;
  review: ReviewChoice;
}

/** The first step of adding another car inside the window (L2-033, L2-085): its optional VIN and review, then the booking flow. */
@Component({
  selector: 'sl-add-another-car-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="another-title">Add another car for $25</h2>
      <p id="another-description">
        Compare more cars within your window. We’ll ask for the seller’s details next.
      </p>
      @if (failed()) {
        <sl-alert
          title="We couldn’t add the car"
          text="Your window is still open. Check your connection and try again."
        >
          <sl-button variant="outline" (pressed)="submit()">Try again</sl-button>
        </sl-alert>
      }
      @if (closed()) {
        <sl-alert
          title="Your window has closed"
          text="A new inspection is $50 and starts a new window. Your reports stay in your account."
        />
      }
      <div class="field">
        <label for="next-vin">VIN of the next car (optional)</label>
        <input
          id="next-vin"
          type="text"
          [value]="vin()"
          [readOnly]="busy()"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? 'next-vin-error' : null"
          (input)="vin.set($any($event.target).value)"
        />
        @if (error()) {
          <p class="error" id="next-vin-error">{{ error() }}</p>
        }
      </div>
      <fieldset>
        <legend>Review type</legend>
        @for (o of options; track o.value) {
          <label class="option">
            <input
              type="radio"
              name="review"
              [value]="o.value"
              [checked]="review() === o.value"
              [disabled]="busy()"
              (change)="review.set(o.value)"
            />
            <span
              >{{ o.label }} <small>{{ o.hint }}</small></span
            >
          </label>
        }
      </fieldset>
      <p class="note">{{ note }}</p>
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button type="submit" [busy]="busy()">Continue</sl-button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(480px, 100vw - 32px);
      max-height: calc(100dvh - 32px);
      overflow: auto;
      padding: var(--spacingVerticalXXL);
      border-radius: var(--borderRadiusLarge);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font-family: var(--fontFamilyBase);
    }
    h2,
    p {
      margin: 0;
    }
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    input[type='text'] {
      min-height: 40px;
      padding: 0 var(--spacingHorizontalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke1);
      border-radius: var(--borderRadiusMedium);
      font: inherit;
    }
    input[aria-invalid='true'] {
      border-color: var(--colorStatusDangerForeground1);
    }
    fieldset {
      display: grid;
      gap: var(--spacingVerticalS);
      margin: 0;
      padding: 0;
      border: 0;
    }
    .option {
      display: flex;
      gap: var(--spacingHorizontalS);
    }
    small,
    .note {
      color: var(--colorNeutralForeground3);
    }
    .error {
      color: var(--colorStatusDangerForeground1);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class AddAnotherCarDialog {
  protected readonly ref = inject<DialogRef<AddAnotherResult>>(DialogRef);
  private readonly data = inject<AddAnotherData>(DIALOG_DATA);
  private readonly payments = inject(PAYMENTS_API);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly options: { value: ReviewChoice; label: string; hint: string }[] = [
    { value: 'Mechanic', label: 'Mechanic', hint: 'Safety certification estimate' },
    { value: 'BodyShop', label: 'Body shop', hint: 'Rust, paint and panel damage' },
    { value: 'Both', label: 'Both', hint: '+$20 · Mechanical and body in one call' },
  ];
  protected readonly note = `Your window is open until ${this.data.window.endsAt ? dayLabel(this.data.window.endsAt) : ''}, so this car is $25. Choosing both adds $20.`;

  protected readonly vin = signal('');
  protected readonly review = signal<ReviewChoice>('Mechanic');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly closed = signal(false);

  protected submit(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    this.failed.set(false);
    this.closed.set(false);
    // The VIN is optional (ADR 0018): it only pre-fills the vehicle step, where the year, make and model are asked.
    const vin = this.vin().trim();
    if (vin && vin.length !== 17) {
      this.error.set('Enter the full 17-character VIN.');
      queueMicrotask(() =>
        this.host.nativeElement.querySelector<HTMLElement>('#next-vin')?.focus(),
      );
      return;
    }
    this.error.set(null);
    this.busy.set(true);
    // The server decides whether the window is still open before the buyer starts the booking.
    this.payments.pricingWindow().subscribe({
      next: (w) => {
        if (w.state === 'Open' || w.state === 'ClosingSoon')
          this.ref.close({ vin, review: this.review() });
        else {
          this.busy.set(false);
          this.closed.set(true);
        }
      },
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

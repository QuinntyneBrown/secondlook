import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BOOKINGS_API, CancelReason, Inspection } from 'api';
import { Alert, Button } from 'components';
import { callTime } from '../util/eastern-time';

export interface CancelData {
  inspection: Inspection;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Cancels an inspection with a required reason; "Keep inspection" is the focused safe action (L2-037, L2-065). */
@Component({
  selector: 'sl-cancel-inspection-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="cancel-title">Cancel the {{ data.inspection.vehicle.vin }} inspection?</h2>
      <p id="cancel-description">
        {{ data.inspection.mechanicName }}’s slot on {{ when }} will be released and
        {{ data.inspection.vehicle.sellerName }} will be told.
      </p>
      @if (failed()) {
        <sl-alert
          title="We couldn’t cancel it"
          text="Nothing changed; the inspection is still booked. Try again, or contact support."
        >
          <sl-button variant="outline" (pressed)="submit()">Try again</sl-button>
        </sl-alert>
      }
      <fieldset [attr.aria-describedby]="needReason() ? 'cancel-reason-error' : null">
        <legend>Why are you cancelling?</legend>
        @for (r of reasons; track r.value) {
          <label>
            <input
              type="radio"
              name="reason"
              [value]="r.value"
              [checked]="reason() === r.value"
              [disabled]="busy()"
              (change)="choose(r.value)"
            />
            <span>{{ r.label }}</span>
          </label>
        }
        @if (needReason()) {
          <p class="error" id="cancel-reason-error">Choose a reason so we can improve.</p>
        }
      </fieldset>
      <section class="refund" aria-label="Refund">
        <strong>You’ll get {{ money(data.inspection.refundPreviewCents) }} back</strong>
        @if (full) {
          <span>
            Cancelling more than 2 hours before the call is a full refund to the card ending
            {{ data.inspection.cardLast4 }}, usually within 3 business days.
          </span>
        } @else {
          <span>
            Cancelling less than 2 hours before the call keeps a $25 fee. The rest goes back to the
            card ending
            {{ data.inspection.cardLast4 }}, usually within 3 business days.
          </span>
        }
      </section>
      <div class="actions">
        <sl-button data-keep variant="outline" [disabled]="busy()" (pressed)="ref.close(false)"
          >Keep inspection</sl-button
        >
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Cancelling' : 'Cancel inspection'
        }}</sl-button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(520px, 100vw - 32px);
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
    fieldset {
      display: grid;
      gap: var(--spacingVerticalS);
      margin: 0;
      padding: 0;
      border: 0;
    }
    label {
      display: flex;
      gap: var(--spacingHorizontalS);
    }
    .error {
      color: var(--colorStatusDangerForeground1);
    }
    .refund {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalM);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground3);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class CancelInspectionDialog {
  protected readonly ref = inject<DialogRef<Inspection | false>>(DialogRef);
  protected readonly data = inject<CancelData>(DIALOG_DATA);
  private readonly api = inject(BOOKINGS_API);

  protected readonly money = money;
  protected readonly reasons: { value: CancelReason; label: string }[] = [
    { value: 'DifferentCar', label: 'I bought a different car' },
    { value: 'SellerBackedOut', label: 'The seller backed out' },
    { value: 'PriceChanged', label: 'The price changed' },
    { value: 'Other', label: 'Something else' },
  ];
  protected readonly when = callTime(this.data.inspection.start);
  protected readonly full =
    this.data.inspection.refundPreviewCents >= this.data.inspection.amountCents;

  protected readonly reason = signal<CancelReason | null>(null);
  protected readonly needReason = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected choose(reason: CancelReason) {
    this.reason.set(reason);
    this.needReason.set(false);
  }

  protected submit(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    const reason = this.reason();
    if (!reason) {
      this.needReason.set(true);
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    this.api.cancel(this.data.inspection.id, reason).subscribe({
      next: (cancelled) => this.ref.close(cancelled),
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

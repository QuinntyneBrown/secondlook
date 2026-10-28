import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiProblem, Vehicle, VEHICLES_API } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';

export interface VehicleDialogData {
  /** Present when editing a saved vehicle. */
  vehicle?: Vehicle;
}

const VIN_LETTERS = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** Adds or edits a saved vehicle. Opened with the CDK Dialog (modal, Escape closes), per L2-065. */
@Component({
  selector: 'sl-vehicle-dialog',
  imports: [FormField, Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="vehicle-title">{{ editing ? 'Edit vehicle' : 'Add a vehicle' }}</h2>
      <p id="vehicle-description">The details we show the mechanic.</p>
      @if (summary().length) {
        <sl-alert
          [title]="
            'Fix ' +
            summary().length +
            (summary().length === 1 ? ' thing' : ' things') +
            ' to continue'
          "
          [items]="summary()"
          [focusOnShow]="true"
        />
      }
      @if (problem(); as p) {
        <sl-alert [title]="p.title" [text]="p.text" />
      }
      <sl-form-field
        fieldId="v-vin"
        label="VIN"
        [error]="errors()['v-vin']"
        [readonly]="busy()"
        [(value)]="vin"
      />
      <sl-form-field
        fieldId="v-km"
        label="Odometer (km)"
        [error]="errors()['v-km']"
        [readonly]="busy()"
        [(value)]="km"
      />
      <sl-form-field
        fieldId="v-price"
        label="Asking price ($)"
        [error]="errors()['v-price']"
        [readonly]="busy()"
        [(value)]="price"
      />
      <sl-form-field
        fieldId="v-url"
        label="Listing link (optional)"
        [error]="errors()['v-url']"
        [readonly]="busy()"
        [(value)]="url"
      />
      <sl-form-field
        fieldId="v-name"
        label="Seller’s name"
        [error]="errors()['v-name']"
        [readonly]="busy()"
        [(value)]="name"
      />
      <sl-form-field
        fieldId="v-phone"
        label="Seller’s phone"
        [error]="errors()['v-phone']"
        [readonly]="busy()"
        [(value)]="phone"
      />
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Saving' : editing ? 'Save changes' : 'Save vehicle'
        }}</sl-button>
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
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class VehicleDialog {
  protected readonly ref = inject<DialogRef<Vehicle>>(DialogRef);
  private readonly data = inject<VehicleDialogData>(DIALOG_DATA);
  private readonly api = inject(VEHICLES_API);

  protected readonly editing = !!this.data.vehicle;
  protected readonly vin = signal(this.data.vehicle?.vin ?? '');
  protected readonly km = signal(this.data.vehicle ? String(this.data.vehicle.odometerKm) : '');
  protected readonly price = signal(this.data.vehicle ? String(this.data.vehicle.askingPrice) : '');
  protected readonly url = signal(this.data.vehicle?.listingUrl ?? '');
  protected readonly name = signal(this.data.vehicle?.sellerName ?? '');
  protected readonly phone = signal(this.data.vehicle?.sellerPhone ?? '');
  protected readonly busy = signal(false);
  protected readonly problem = signal<{ title: string; text: string } | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.problem.set(null);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    const add = (id: string, summary: string, field = summary) => {
      errors[id] = field;
      items.push({ message: summary, fieldId: id });
    };
    const vin = this.vin().trim();
    if (vin.length !== 17)
      add(
        'v-vin',
        'Enter the full 17-character VIN.',
        `A VIN has 17 characters. This one has ${vin.length}.`,
      );
    else if (!VIN_LETTERS.test(vin))
      add('v-vin', 'A VIN uses letters and digits, but never I, O or Q.');

    const km = Number(this.km().replace(/[\s,]/g, ''));
    if (!this.km().trim() || !Number.isInteger(km) || km < 0 || km > 1_500_000)
      add('v-km', 'Enter the odometer reading in kilometres, up to 1,500,000.');
    const price = Number(this.price().replace(/[\s,$]/g, ''));
    if (!this.price().trim() || Number.isNaN(price) || price < 0 || price > 1_000_000)
      add('v-price', 'Enter the asking price in dollars, up to 1,000,000.');
    const url = this.url().trim();
    if (url && !/^https?:\/\/\S+$/i.test(url))
      add('v-url', 'Enter a link that starts with http:// or https://.');
    const name = this.name().trim();
    if (!name || name.length > 100) add('v-name', 'Enter the seller’s name, up to 100 characters.');
    const digits = this.phone().replace(/\D/g, '');
    if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))))
      add('v-phone', 'Enter the seller’s 10-digit phone number.', 'Enter a 10-digit phone number.');

    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    const input = {
      vin,
      odometerKm: km,
      askingPrice: price,
      listingUrl: url || null,
      sellerName: name,
      sellerPhone: this.phone().trim(),
    };
    const call = this.data.vehicle
      ? this.api.update(this.data.vehicle.id, input)
      : this.api.add(input);
    call.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (p: ApiProblem) => {
        this.busy.set(false);
        if (p.status === 409)
          this.problem.set({
            title: 'You already saved that vehicle',
            text: 'Edit the saved one instead, or remove it first.',
          });
        else
          this.problem.set({
            title: 'We couldn’t save that vehicle',
            text: 'Something went wrong on our side. Nothing was saved. Try again.',
          });
      },
    });
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiProblem, Vehicle, VEHICLES_API } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';
import { validateVehicle } from '../util/vehicle-form';

export interface VehicleDialogData {
  /** Present when editing a saved vehicle. */
  vehicle?: Vehicle;
}

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
        fieldId="v-year"
        label="Year"
        [error]="errors()['v-year']"
        [readonly]="busy()"
        [(value)]="year"
      />
      <sl-form-field
        fieldId="v-make"
        label="Make"
        [error]="errors()['v-make']"
        [readonly]="busy()"
        [(value)]="make"
      />
      <sl-form-field
        fieldId="v-model"
        label="Model"
        [error]="errors()['v-model']"
        [readonly]="busy()"
        [(value)]="model"
      />
      <sl-form-field
        fieldId="v-vin"
        label="VIN (optional)"
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
  // A vehicle saved before ADR 0018 has year 0 and no make: the buyer is asked for them.
  protected readonly year = signal(this.data.vehicle?.year ? String(this.data.vehicle.year) : '');
  protected readonly make = signal(this.data.vehicle?.make ?? '');
  protected readonly model = signal(this.data.vehicle?.model ?? '');
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

    const result = validateVehicle({
      year: this.year(),
      make: this.make(),
      model: this.model(),
      vin: this.vin(),
      km: this.km(),
      price: this.price(),
      url: this.url(),
      name: this.name(),
      phone: this.phone(),
    });
    this.errors.set(result.errors);
    this.summary.set([]);
    if (!result.input) {
      queueMicrotask(() => this.summary.set(result.items));
      return;
    }

    this.busy.set(true);
    const input = result.input;
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

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Vehicle, VEHICLES_API } from 'api';
import { Alert, Button } from 'components';

export interface RemoveVehicleData {
  vehicle: Vehicle;
}

/** Confirms removing a saved vehicle; "Cancel" is the focused safe action (L2-065). */
@Component({
  selector: 'sl-remove-vehicle-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="remove-vehicle-title">Remove {{ data.vehicle.vin }}?</h2>
      <p id="remove-vehicle-description">
        It will leave your list. Inspections you have already booked for it keep their details.
      </p>
      @if (failed()) {
        <sl-alert
          title="We couldn’t remove that vehicle"
          text="Something went wrong on our side. Nothing was changed. Try again."
        />
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close(false)"
          >Cancel</sl-button
        >
        <sl-button [busy]="busy()" (pressed)="confirm()">{{
          busy() ? 'Removing' : 'Remove'
        }}</sl-button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(440px, 100vw - 32px);
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
export class RemoveVehicleDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<RemoveVehicleData>(DIALOG_DATA);
  private readonly api = inject(VEHICLES_API);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected confirm() {
    this.busy.set(true);
    this.failed.set(false);
    this.api.remove(this.data.vehicle.id).subscribe({
      next: () => this.ref.close(true),
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

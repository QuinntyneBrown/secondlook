import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Vehicle, VEHICLES_API } from 'api';
import { Alert, Button } from 'components';
import { RemoveVehicleDialog } from '../dialogs/remove-vehicle-dialog';
import { VehicleDialog } from '../dialogs/vehicle-dialog';

type View = 'loading' | 'ready' | 'failed';

/** The buyer's saved vehicles (L2-063). Add, edit and remove open dialogs. */
@Component({
  selector: 'sl-vehicles-page',
  imports: [Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="top" aria-label="Primary">
      <a routerLink="/inspections">Inspections</a>
      <a routerLink="/vehicles" aria-current="page">Vehicles</a>
      <a routerLink="/compare">Compare</a>
      <a routerLink="/billing">Billing</a>
    </nav>
    <div class="head">
      <div>
        <h1>Your vehicles</h1>
        <p class="sub">{{ subtitle() }}</p>
      </div>
      <sl-button (pressed)="open()">Add a vehicle</sl-button>
    </div>

    @if (view() === 'failed') {
      <sl-alert
        title="We couldn’t load your vehicles"
        text="The list didn’t come through. Nothing was changed. Try again in a moment."
      >
        <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
      </sl-alert>
    } @else if (view() === 'ready' && vehicles().length === 0) {
      <div class="none">
        <h2>No saved vehicles yet</h2>
        <p>Save the cars you are comparing. You can pick one when you book an inspection.</p>
      </div>
    } @else {
      <div [attr.aria-busy]="view() === 'loading' ? 'true' : null">
        <table>
          <caption class="sr-only">
            Your saved vehicles
          </caption>
          <thead>
            <tr>
              <th scope="col">VIN</th>
              <th scope="col">Odometer</th>
              <th scope="col">Asking price</th>
              <th scope="col">Seller</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (v of vehicles(); track v.id) {
              <tr>
                <th scope="row">{{ v.vin }}</th>
                <td>{{ odometer(v) }}</td>
                <td>{{ price(v) }}</td>
                <td>{{ v.sellerName }} · {{ v.sellerPhone }}</td>
                <td class="actions">
                  <sl-button variant="outline" (pressed)="open(v)">Edit</sl-button>
                  <sl-button variant="outline" (pressed)="remove(v)">Remove</sl-button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (view() === 'loading') {
        <p role="status" class="sr-only">Loading your vehicles</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    .top {
      display: flex;
      gap: var(--spacingHorizontalL);
      margin-bottom: var(--spacingVerticalL);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--spacingVerticalL);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub {
      color: var(--colorNeutralForeground2);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: var(--spacingVerticalM) var(--spacingHorizontalM);
      border-bottom: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      text-align: left;
    }
    .actions {
      display: flex;
      gap: var(--spacingHorizontalS);
    }
    .none {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalXXL) 0;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class VehiclesPage {
  private readonly api = inject(VEHICLES_API);
  private readonly dialog = inject(Dialog);

  protected readonly view = signal<View>('loading');
  protected readonly vehicles = signal<Vehicle[]>([]);

  constructor() {
    this.load();
  }

  protected subtitle() {
    if (this.view() === 'loading') return 'Loading your vehicles';
    const n = this.vehicles().length;
    return n === 0 ? 'Nothing saved yet' : `${n} saved ${n === 1 ? 'vehicle' : 'vehicles'}`;
  }

  protected odometer = (v: Vehicle) => `${v.odometerKm.toLocaleString('en-CA')} km`;
  protected price = (v: Vehicle) =>
    `$${v.askingPrice.toLocaleString('en-CA', { maximumFractionDigits: 2 })}`;

  protected load() {
    this.view.set('loading');
    this.api.list().subscribe({
      next: (list) => {
        this.vehicles.set(list);
        this.view.set('ready');
      },
      error: () => this.view.set('failed'),
    });
  }

  protected open(vehicle?: Vehicle) {
    const ref = this.dialog.open<Vehicle>(VehicleDialog, {
      data: { vehicle },
      ariaLabelledBy: 'vehicle-title',
      ariaDescribedBy: 'vehicle-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.load();
    });
  }

  protected remove(vehicle: Vehicle) {
    const ref = this.dialog.open<boolean>(RemoveVehicleDialog, {
      data: { vehicle },
      ariaLabelledBy: 'remove-vehicle-title',
      ariaDescribedBy: 'remove-vehicle-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((removed) => {
      if (removed) this.load();
    });
  }
}

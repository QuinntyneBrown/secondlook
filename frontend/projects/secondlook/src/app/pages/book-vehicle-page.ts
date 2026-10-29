import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiProblem, VEHICLES_API } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';
import { BookingDraft } from '../booking/booking-draft';
import { BookingSteps, BuyerNav } from '../booking/booking-chrome';
import { validateVehicle } from '../util/vehicle-form';

/** Step 1 of booking (L2-023): the car and the seller. The car is saved to the buyer's vehicles. */
@Component({
  selector: 'sl-book-vehicle-page',
  imports: [Alert, Button, FormField, BookingSteps, BuyerNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page">
      <h1>Book an inspection</h1>
      <p class="lead">Tell us about the car. It takes about two minutes.</p>
      <sl-booking-steps [current]="0" />
      <form novalidate (submit)="submit($event)">
        <h2>The car and the seller</h2>
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
        @if (failed()) {
          <sl-alert
            title="We couldn’t save the car"
            text="Something went wrong on our side. Your answers are saved here. Try again."
          />
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
          <sl-button type="submit" [busy]="busy()">{{
            busy() ? 'Checking the VIN' : 'Continue to review type'
          }}</sl-button>
        </div>
      </form>
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
      width: min(560px, 100%);
      margin: 0 auto;
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .lead {
      color: var(--colorNeutralForeground2);
    }
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class BookVehiclePage {
  private readonly vehicles = inject(VEHICLES_API);
  private readonly draft = inject(BookingDraft);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly year = signal('');
  protected readonly make = signal('');
  protected readonly model = signal('');
  protected readonly vin = signal('');
  protected readonly km = signal('');
  protected readonly price = signal('');
  protected readonly url = signal('');
  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  constructor() {
    // A new booking starts here: forget earlier answers and purchase attempts.
    this.draft.reset();
    // "Add another car" opens this step with the next car's VIN and review already chosen.
    const query = this.route.snapshot.queryParamMap;
    const review = query.get('review');
    if (review === 'Mechanic' || review === 'BodyShop' || review === 'Both')
      this.draft.update({ review });
    this.vin.set(query.get('vin') ?? '');
  }

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.failed.set(false);
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
    this.vehicles.add(input).subscribe({
      next: (v) => this.next(v),
      error: (p: ApiProblem) => {
        // The same VIN already saved: book that saved vehicle instead of failing. Only a given VIN can conflict (ADR 0018).
        if (p.status === 409)
          this.vehicles.list().subscribe({
            next: (list) => {
              const saved = list.find((x) => x.vin === input.vin?.toUpperCase());
              if (saved) this.next(saved);
              else this.fail();
            },
            error: () => this.fail(),
          });
        else this.fail();
      },
    });
  }

  private next(vehicle: Parameters<BookingDraft['update']>[0]['vehicle']) {
    this.draft.update({ vehicle });
    void this.router.navigateByUrl('/book/review');
  }

  private fail() {
    this.busy.set(false);
    this.failed.set(true);
  }
}

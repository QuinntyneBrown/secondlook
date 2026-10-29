import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { COMPARISONS_API, Comparison, ComparisonColumn, PAYMENTS_API, PricingWindow } from 'api';
import { Alert, Button } from 'components';
import { BuyerNav } from '../booking/booking-chrome';
import { AddAnotherCarDialog, AddAnotherResult } from '../dialogs/add-another-car-dialog';
import { dollarRange, dollars } from '../util/money';

type Load = 'loading' | 'ready' | 'failed';

/** "Compare cars" (L2-051, L2-052): the buyer's cars from one pricing window, lowest all-in first. */
@Component({
  selector: 'sl-compare-page',
  imports: [Alert, Button, BuyerNav, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page">
      <div class="head">
        <div>
          <h1>Compare cars</h1>
          @if (state() === 'ready' && columns().length >= 2) {
            <p class="sub">Same window, {{ columns().length }} reports. Lowest all-in first.</p>
          }
        </div>
        <sl-button (pressed)="addAnother()">Add another car · {{ price() }}</sl-button>
      </div>

      <section aria-label="Comparison" [attr.aria-busy]="state() === 'loading' ? 'true' : null">
        @switch (state()) {
          @case ('ready') {
            @if (columns().length >= 2) {
              <ol aria-label="Cars" class="cars">
                @for (c of columns(); track c.inspectionId) {
                  <li [class.lowest]="c.lowest">
                    @if (c.lowest) {
                      <span class="badge">Lowest all-in</span>
                    }
                    <strong class="car">{{ c.vehicleName }}</strong>
                    <span class="muted">
                      @if (c.vin && c.vin !== c.vehicleName) {
                        VIN {{ c.vin }} ·
                      }
                      {{ c.odometerKm.toLocaleString('en-CA') }} km</span
                    >
                    @switch (c.status) {
                      @case ('Ready') {
                        <p class="label">All-in, asking price plus certification</p>
                        <p class="allin">{{ range(c.allInMinCents!, c.allInMaxCents!) }}</p>
                        <p>Asking {{ money(c.askingPriceCents) }}</p>
                        <p>To certify {{ range(c.costMinCents!, c.costMaxCents!) }}</p>
                        <a [routerLink]="'/inspections/' + c.inspectionId + '/report'"
                          >View report</a
                        >
                      }
                      @case ('NoEstimate') {
                        <p class="label">No certification estimate</p>
                        <p class="muted">
                          This was a body shop review, so there is no mechanic’s estimate to
                          compare. Asking {{ money(c.askingPriceCents) }}.
                        </p>
                        <a [routerLink]="'/inspections/' + c.inspectionId + '/report'"
                          >View report</a
                        >
                      }
                      @default {
                        <p class="label">Estimate not ready yet</p>
                        <p class="muted">
                          The mechanic is still writing it. This car joins the comparison once it’s
                          sent. Asking {{ money(c.askingPriceCents) }}.
                        </p>
                        <a [routerLink]="'/inspections/' + c.inspectionId">View inspection</a>
                      }
                    }
                  </li>
                }
              </ol>
              <p class="note">
                Costs are estimates from each mechanic’s call. The cheapest car all-in isn’t always
                the best car. That’s your decision.
              </p>
            } @else if (columns().length === 1) {
              <div class="empty">
                <h2>Compare needs two cars</h2>
                <p>
                  You’ve only had one inspection. Add another car in this window for
                  {{ price() }} and we’ll line them up.
                </p>
                <sl-button (pressed)="addAnother()">Add a second car</sl-button>
              </div>
            } @else {
              <div class="empty">
                <h2>Compare needs two cars</h2>
                <p>
                  You haven’t had an inspection yet. Book one, then add a second car in the same
                  window for {{ price() }} and we’ll line them up.
                </p>
                <a routerLink="/book/vehicle">Book an inspection</a>
              </div>
            }
          }
          @case ('failed') {
            <sl-alert
              variant="danger"
              title="The comparison didn’t load"
              text="Your reports are fine. Try again."
            >
              <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
            </sl-alert>
          }
          @default {
            <p role="status">Loading your cars…</p>
          }
        }
      </section>
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
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--spacingHorizontalM);
    }
    .head > div {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    section {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub,
    .muted,
    .label {
      color: var(--colorNeutralForeground2);
    }
    .cars {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
      gap: var(--spacingHorizontalL);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cars li {
      display: grid;
      align-content: start;
      gap: var(--spacingVerticalS);
      min-width: 0;
      padding: var(--spacingVerticalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusLarge);
    }
    .cars li.lowest {
      border-color: var(--colorStatusSuccessForeground1);
    }
    .badge {
      justify-self: start;
      padding: 2px var(--spacingHorizontalS);
      border-radius: var(--borderRadiusSmall);
      background: var(--colorStatusSuccessBackground1);
      color: var(--colorStatusSuccessForeground1);
      font-weight: var(--fontWeightSemibold);
    }
    .car {
      overflow-wrap: anywhere;
    }
    .allin {
      font-size: var(--fontSizeBase500);
      font-weight: var(--fontWeightSemibold);
    }
    .note {
      color: var(--colorNeutralForeground2);
    }
    .empty {
      display: grid;
      gap: var(--spacingVerticalM);
      justify-items: start;
    }
  `,
})
export class ComparePage implements OnInit {
  private readonly api = inject(COMPARISONS_API);
  private readonly payments = inject(PAYMENTS_API);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);

  protected readonly state = signal<Load>('loading');
  protected readonly columns = signal<ComparisonColumn[]>([]);
  private readonly window = signal<PricingWindow | null>(null);
  protected readonly money = dollars;
  protected readonly range = dollarRange;

  ngOnInit() {
    this.load();
    this.payments.pricingWindow().subscribe({ next: (w) => this.window.set(w) });
  }

  protected load() {
    this.state.set('loading');
    this.api.get().subscribe({
      next: (c: Comparison) => {
        this.columns.set(c.columns);
        this.state.set('ready');
      },
      error: () => this.state.set('failed'),
    });
  }

  /** The price of one more car: $25 inside the window, a new inspection's price once it has closed. */
  protected price() {
    const w = this.window();
    if (!w) return '$25';
    return dollars(
      w.state === 'Open' || w.state === 'ClosingSoon'
        ? w.additionalVehicleCents
        : w.newInspectionCents,
    );
  }

  protected addAnother() {
    const w = this.window();
    if (!w) return;
    const ref = this.dialog.open<AddAnotherResult>(AddAnotherCarDialog, {
      data: { window: w },
      ariaLabelledBy: 'another-title',
      ariaDescribedBy: 'another-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((r) => {
      if (r)
        void this.router.navigate(['/book/vehicle'], {
          queryParams: { vin: r.vin, review: r.review },
        });
    });
  }
}

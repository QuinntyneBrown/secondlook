import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BOOKINGS_API, Inspection, PAYMENTS_API, PricingWindow } from 'api';
import { Alert, Button } from 'components';
import { AddAnotherCarDialog, AddAnotherResult } from '../dialogs/add-another-car-dialog';
import { SignOutDialog } from '../dialogs/sign-out-dialog';
import { WindowBanner } from '../booking/window-banner';
import { Session } from '../session';
import { callTime } from '../util/eastern-time';
import { providerNames } from '../util/providers';

type View = 'loading' | 'ready' | 'failed';

/** The dashboard (L2-019): the buyer's inspections, with the way to book another. */
@Component({
  selector: 'sl-inspections-page',
  imports: [Alert, Button, RouterLink, WindowBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <nav aria-label="Primary">
        <a routerLink="/inspections" aria-current="page">Inspections</a>
        <a routerLink="/vehicles">Vehicles</a>
        <a routerLink="/compare">Compare</a>
        <a routerLink="/billing">Billing</a>
      </nav>
      <span>{{ session.displayName() }}</span>
      <sl-button variant="outline" (pressed)="signOut()">Sign out</sl-button>
    </header>
    <div class="head">
      <div>
        <h1>Your inspections</h1>
        <p class="sub">{{ subtitle() }}</p>
      </div>
      <sl-button routerLink="/book/vehicle">Book an inspection</sl-button>
    </div>

    @if (added(); as a) {
      <sl-alert
        variant="success"
        [title]="a.vin + ' added for ' + a.price"
        [text]="
          a.count + ' cars are in your window. Compare them side by side when the reports land.'
        "
      />
    }
    <sl-window-banner [window]="window()" (add)="addAnother()" />

    @if (view() === 'failed') {
      <sl-alert
        title="We couldn’t load your inspections"
        text="They’re still booked. Try again in a moment."
      >
        <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
      </sl-alert>
    } @else if (view() === 'ready' && inspections().length === 0) {
      <div class="none">
        <h2>No inspections yet</h2>
        <p>
          Book a mechanic to look at a car over video. Your first inspection is $50 and you get a
          cost estimate within an hour.
        </p>
        <a routerLink="/book/vehicle">Book an inspection</a>
      </div>
    } @else {
      <div role="tablist" aria-label="Inspections">
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="tab() === 'active'"
          (click)="tab.set('active')"
        >
          Active {{ active().length }}
        </button>
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="tab() === 'past'"
          (click)="tab.set('past')"
        >
          Past
        </button>
      </div>
      <ul [attr.aria-busy]="view() === 'loading' ? 'true' : null">
        @for (i of shown(); track i.id) {
          <li>
            <a [routerLink]="['/inspections', i.id]">{{ i.vehicle.vin }}</a>
            <span class="meta"
              >{{ reviewLabel(i) }} · {{ names(i) }} ·
              {{ '$' + i.vehicle.askingPrice.toLocaleString('en-CA') }}</span
            >
            <span class="chip">{{ i.status === 'Cancelled' ? 'Cancelled' : callTime(i) }}</span>
          </li>
        }
      </ul>
      @if (view() === 'loading') {
        <p role="status" class="sr-only">Loading your inspections</p>
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
    header {
      display: flex;
      align-items: center;
      gap: var(--spacingHorizontalM);
      margin-bottom: var(--spacingVerticalL);
    }
    nav {
      display: flex;
      gap: var(--spacingHorizontalL);
      margin-right: auto;
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
    [role='tablist'] {
      display: flex;
      gap: var(--spacingHorizontalM);
      margin-bottom: var(--spacingVerticalM);
    }
    [role='tab'] {
      border: 0;
      background: none;
      padding: var(--spacingVerticalS) 0;
      font: inherit;
      color: var(--colorNeutralForeground2);
    }
    [role='tab'][aria-selected='true'] {
      border-bottom: 2px solid var(--colorBrandStroke1);
      color: var(--colorNeutralForeground1);
    }
    ul {
      display: grid;
      gap: var(--spacingVerticalS);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--spacingHorizontalL);
      padding: var(--spacingVerticalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .meta {
      flex: 1;
      color: var(--colorNeutralForeground2);
    }
    .chip {
      padding: 2px var(--spacingHorizontalM);
      border-radius: 999px;
      background: var(--colorNeutralBackground3);
    }
    .none {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalXXL) 0;
      max-width: 60ch;
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
export class InspectionsPage {
  protected readonly names = providerNames;
  protected readonly session = inject(Session);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly api = inject(BOOKINGS_API);
  private readonly payments = inject(PAYMENTS_API);
  protected readonly window = signal<PricingWindow | null>(null);
  protected readonly added = signal<{ vin: string; price: string; count: string } | null>(null);

  protected readonly view = signal<View>('loading');
  protected readonly inspections = signal<Inspection[]>([]);
  protected readonly tab = signal<'active' | 'past'>('active');
  protected readonly active = computed(() =>
    this.inspections().filter((i) => i.status !== 'Cancelled'),
  );
  protected readonly shown = computed(() =>
    this.tab() === 'active'
      ? this.active()
      : this.inspections().filter((i) => i.status === 'Cancelled'),
  );
  protected readonly callTime = (i: Inspection) => callTime(i.start);
  protected readonly subtitle = computed(() => {
    if (this.view() === 'loading') return 'Loading your inspections';
    const n = this.active().length;
    return this.inspections().length === 0 ? 'Nothing booked yet' : `${n} active`;
  });

  constructor() {
    this.load();
    this.loadWindow();
  }

  private static readonly WORDS = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
  ];

  /** The window comes from the server; a car just added in it is announced once (L2-033). */
  private loadWindow() {
    this.payments.pricingWindow().subscribe({
      next: (w) => {
        this.window.set(w);
        let flag: { vin: string; cents: number } | null = null;
        try {
          flag = JSON.parse(sessionStorage.getItem('secondlook.addedCar') ?? 'null');
          sessionStorage.removeItem('secondlook.addedCar');
        } catch {
          // nothing to announce
        }
        if (flag)
          this.added.set({
            vin: flag.vin,
            price: `$${flag.cents % 100 === 0 ? flag.cents / 100 : (flag.cents / 100).toFixed(2)}`,
            count: InspectionsPage.WORDS[w.carsInWindow] ?? String(w.carsInWindow),
          });
      },
      error: () => this.window.set(null),
    });
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

  protected reviewLabel(i: Inspection) {
    return i.review === 'Both'
      ? 'Mechanic + body shop'
      : i.review === 'BodyShop'
        ? 'Body shop'
        : 'Mechanic';
  }

  protected load() {
    this.view.set('loading');
    this.api.inspections().subscribe({
      next: (list) => {
        this.inspections.set(list);
        this.view.set('ready');
      },
      error: () => this.view.set('failed'),
    });
  }

  protected signOut() {
    const ref = this.dialog.open<boolean>(SignOutDialog, {
      ariaLabelledBy: 'sign-out-title',
      ariaDescribedBy: 'sign-out-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((signedOut) => {
      if (signedOut) void this.router.navigateByUrl('/sign-in');
    });
  }
}

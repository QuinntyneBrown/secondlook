import { Dialog } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BOOKINGS_API,
  HistoryItem,
  HistoryTab,
  InspectionHistory,
  PAYMENTS_API,
  PricingWindow,
} from 'api';
import { Alert, Button } from 'components';
import { AddAnotherCarDialog, AddAnotherResult } from '../dialogs/add-another-car-dialog';
import { SignOutDialog } from '../dialogs/sign-out-dialog';
import { WindowBanner } from '../booking/window-banner';
import { Session } from '../session';
import { callTime, dayLabel } from '../util/eastern-time';
import { dollarRange, dollars } from '../util/money';
import { providerNames } from '../util/providers';

type View = 'loading' | 'ready' | 'failed';

const SUPPORT = 'mailto:support@secondlook.example';

/**
 * The dashboard and the buyer's history (L2-019 to L2-022): Active and Past tabs, rows with their estimates, twenty to a page. The
 * tab and the page live in the address, so going back from a report returns to the same place.
 */
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
        variant="danger"
        title="Your inspections didn’t load"
        text="This is on our side. Your bookings are safe. Try again, or check back in a minute."
      >
        <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
        <a [href]="support">Contact support</a>
      </sl-alert>
    } @else if (view() === 'ready' && nothingBooked()) {
      <div class="none">
        <h2>No inspections yet</h2>
        <p>
          Book a mechanic to look at a car over video. Your first inspection is $50 and you get a
          cost estimate within an hour.
        </p>
        <div class="actions">
          <a routerLink="/book/vehicle">Book an inspection</a>
          <a routerLink="/sample-report">View sample report</a>
        </div>
      </div>
    } @else {
      <div role="tablist" aria-label="Inspections">
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="tab() === 'Active'"
          (click)="select('Active')"
        >
          Active{{ countOf('Active') }}
        </button>
        <button
          role="tab"
          type="button"
          [attr.aria-selected]="tab() === 'Past'"
          (click)="select('Past')"
        >
          Past{{ countOf('Past') }}
        </button>
      </div>
      <ul aria-label="Inspections" [attr.aria-busy]="view() === 'loading' ? 'true' : null">
        @if (view() === 'loading') {
          @for (n of placeholders; track n) {
            <li class="placeholder" aria-hidden="true"></li>
          }
        } @else {
          @for (i of items(); track i.id) {
            <li>
              <a [routerLink]="link(i)">{{ i.vin }}</a>
              <span class="meta"
                >{{ reviewLabel(i) }} · {{ names(i) }} · {{ money(i.askingPriceCents) }}</span
              >
              <span class="chip">{{ chip(i) }}</span>
              @if (estimate(i); as e) {
                <span class="estimate">{{ e }}</span>
              }
            </li>
          }
        }
      </ul>
      @if (view() === 'loading') {
        <p role="status" class="sr-only">Fetching your list…</p>
      } @else if (items().length === 0) {
        <p class="empty-tab">
          {{
            tab() === 'Past'
              ? 'No past inspections yet. Finished and cancelled inspections show up here.'
              : 'Nothing active right now. Book an inspection to start one.'
          }}
        </p>
      }
      @if (showPaging()) {
        <nav class="paging" aria-label="Pagination">
          <span>Showing {{ from() }}–{{ to() }} of {{ history()!.total }}</span>
          <sl-button variant="outline" [disabled]="page() <= 1" (pressed)="go(page() - 1)"
            >Previous</sl-button
          >
          <sl-button
            variant="outline"
            [disabled]="to() >= history()!.total"
            (pressed)="go(page() + 1)"
            >Next</sl-button
          >
        </nav>
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
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacingHorizontalL);
      margin-bottom: var(--spacingVerticalL);
    }
    nav[aria-label='Primary'] {
      display: flex;
      gap: var(--spacingHorizontalL);
      margin-right: auto;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--spacingHorizontalM);
      margin-bottom: var(--spacingVerticalL);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub,
    .empty-tab {
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
      cursor: pointer;
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
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacingVerticalS) var(--spacingHorizontalL);
      padding: var(--spacingVerticalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    li a {
      overflow-wrap: anywhere;
    }
    li.placeholder {
      min-height: 56px;
      background: var(--colorNeutralBackground3);
      border-color: transparent;
    }
    .meta {
      flex: 1 1 14rem;
      min-width: 0;
      overflow-wrap: anywhere;
      color: var(--colorNeutralForeground2);
    }
    .chip {
      padding: 2px var(--spacingHorizontalM);
      border-radius: 999px;
      background: var(--colorNeutralBackground3);
    }
    .estimate {
      font-weight: var(--fontWeightSemibold);
    }
    .paging {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--spacingHorizontalM);
      margin-top: var(--spacingVerticalL);
    }
    .paging span {
      margin-right: auto;
      color: var(--colorNeutralForeground2);
    }
    .none {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalXXL) 0;
      max-width: 60ch;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalL);
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
  protected readonly money = dollars;
  protected readonly support = SUPPORT;
  protected readonly placeholders = [1, 2, 3];
  protected readonly session = inject(Session);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BOOKINGS_API);
  private readonly payments = inject(PAYMENTS_API);
  protected readonly window = signal<PricingWindow | null>(null);
  protected readonly added = signal<{ vin: string; price: string; count: string } | null>(null);

  protected readonly view = signal<View>('loading');
  protected readonly history = signal<InspectionHistory | null>(null);
  protected readonly tab = signal<HistoryTab>('Active');
  protected readonly page = signal(1);
  protected readonly items = computed(() => this.history()?.items ?? []);
  protected readonly nothingBooked = computed(() => {
    const h = this.history();
    return !!h && h.activeCount === 0 && h.pastCount === 0;
  });
  protected readonly showPaging = computed(() => {
    const h = this.history();
    return this.view() === 'ready' && !!h && h.total > h.pageSize;
  });
  protected readonly from = computed(
    () => (this.page() - 1) * (this.history()?.pageSize ?? 20) + 1,
  );
  protected readonly to = computed(() => {
    const h = this.history();
    return h ? Math.min(this.page() * h.pageSize, h.total) : 0;
  });
  protected readonly subtitle = computed(() => {
    const h = this.history();
    if (this.view() === 'loading' || !h)
      return this.view() === 'failed' ? '' : 'Loading your inspections';
    if (this.nothingBooked()) return 'Nothing booked yet';
    if (h.total > h.pageSize) return `${h.total} inspections · ${h.pageSize} per page`;
    const w = this.window();
    const open = w && (w.state === 'Open' || w.state === 'ClosingSoon') && w.endsAt;
    return `${h.activeCount} active` + (open ? ` · window open until ${dayLabel(w.endsAt!)}` : '');
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((q) => {
      this.tab.set(q.get('tab') === 'past' ? 'Past' : 'Active');
      const n = Number(q.get('page'));
      this.page.set(Number.isInteger(n) && n >= 1 ? n : 1);
      this.load();
    });
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

  protected reviewLabel(i: HistoryItem) {
    return i.review === 'Both'
      ? 'Mechanic + body shop'
      : i.review === 'BodyShop'
        ? 'Body shop'
        : 'Mechanic';
  }

  /** What the row says about where the inspection stands (L2-019 AC3). */
  protected chip(i: HistoryItem) {
    switch (i.phase) {
      case 'Cancelled':
        return 'Cancelled';
      case 'ReportReady':
        return 'Report ready';
      case 'CallEnded':
        return 'Call done · report in progress';
      default:
        return callTime(i.start);
    }
  }

  /** What the mechanic found, in words and cost (L2-021 AC4). */
  protected estimate(i: HistoryItem) {
    const e = i.estimate;
    if (!e) return null;
    return e.state === 'Required'
      ? `Required: ${dollarRange(e.costMinCents ?? 0, e.costMaxCents ?? 0)}`
      : e.state;
  }

  /** A finished inspection opens its report; any other opens the inspection (L2-019 AC4). */
  protected link(i: HistoryItem) {
    return i.phase === 'ReportReady' ? ['/inspections', i.id, 'report'] : ['/inspections', i.id];
  }

  protected countOf(tab: HistoryTab) {
    const h = this.history();
    if (!h) return '';
    return ` ${tab === 'Active' ? h.activeCount : h.pastCount}`;
  }

  protected select(tab: HistoryTab) {
    void this.router.navigate([], {
      queryParams: { tab: tab === 'Past' ? 'past' : null, page: null },
    });
  }

  protected go(page: number) {
    void this.router.navigate([], {
      queryParams: { tab: this.tab() === 'Past' ? 'past' : null, page: page > 1 ? page : null },
    });
  }

  protected load() {
    this.view.set('loading');
    this.api.history(this.tab(), this.page()).subscribe({
      next: (h) => {
        this.history.set(h);
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

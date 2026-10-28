import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PAYMENTS_API, Receipt } from 'api';
import { Alert, Button } from 'components';
import { dayLabel } from '../util/eastern-time';
import { money } from './checkout-page';

type View = 'loading' | 'ready' | 'failed';

/** Receipts for every inspection (L2-031). */
@Component({
  selector: 'sl-billing-page',
  imports: [Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="top" aria-label="Primary">
      <a routerLink="/inspections">Inspections</a>
      <a routerLink="/vehicles">Vehicles</a>
      <a routerLink="/billing" aria-current="page">Billing</a>
    </nav>
    <h1>Billing history</h1>
    <p class="sub">Receipts for every inspection.</p>

    @if (view() === 'failed') {
      <sl-alert title="Receipts didn’t load" text="Your payments are safe. Try again.">
        <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
      </sl-alert>
    } @else if (view() === 'ready' && receipts().length === 0) {
      <div class="none">
        <h2>No receipts yet</h2>
        <p>Receipts appear here after your first booking.</p>
        <a routerLink="/checkout">Book an inspection</a>
      </div>
    } @else {
      <div [attr.aria-busy]="view() === 'loading' ? 'true' : null">
        <table>
          <caption class="sr-only">
            Receipts
          </caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">For</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col"><span class="sr-only">Download</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of receipts(); track r.paymentId) {
              <tr>
                <td>{{ day(r) }}</td>
                <td>{{ r.for }}</td>
                <td>{{ money(r.amountCents) }}</td>
                <td>{{ r.status }}</td>
                <td>
                  <sl-button variant="outline" (pressed)="download(r)"
                    ><span aria-hidden="true">Download</span
                    ><span class="sr-only">Download receipt for {{ r.for }}</span></sl-button
                  >
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (view() === 'loading') {
        <p role="status" class="sr-only">Loading receipts</p>
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
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub {
      margin-bottom: var(--spacingVerticalL);
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
export class BillingPage {
  private readonly api = inject(PAYMENTS_API);
  protected readonly money = money;
  protected readonly view = signal<View>('loading');
  protected readonly receipts = signal<Receipt[]>([]);

  constructor() {
    this.load();
  }

  protected day = (r: Receipt) => dayLabel(r.date);

  protected load() {
    this.view.set('loading');
    this.api.receipts().subscribe({
      next: (list) => {
        this.receipts.set(list);
        this.view.set('ready');
      },
      error: () => this.view.set('failed'),
    });
  }

  /** A plain-text receipt; a formatted PDF is later work. */
  protected download(r: Receipt) {
    const text = [
      'SecondLook receipt',
      `Date: ${this.day(r)}`,
      `For: ${r.for}`,
      `Amount: ${money(r.amountCents)}`,
      `Status: ${r.status}`,
      `Reference: ${r.paymentId}`,
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `secondlook-receipt-${r.paymentId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

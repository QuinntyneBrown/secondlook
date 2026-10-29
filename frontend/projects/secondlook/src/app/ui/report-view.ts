import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Finding, Report } from 'api';
import { dollarRange, dollars } from '../util/money';

/**
 * The body of a report (L2-045, L2-046): the certification cost, the all-in total, the findings and the body shop's
 * part. Shared by the buyer's page and the public shared page, which differ only in what surrounds it.
 */
@Component({
  selector: 'sl-report-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = report();
    <section aria-label="Estimate summary" class="summary">
      <h2>Estimated cost to get it safety certified</h2>
      <p class="range">{{ range(r.costMinCents, r.costMaxCents) }}</p>
      <p>{{ r.requiredCount }} {{ r.requiredCount === 1 ? 'repair' : 'repairs' }} required</p>
    </section>

    <section aria-label="Is it worth it?">
      <h2>Is it worth it?</h2>
      <p>Asking price {{ money(r.askingPriceCents) }}</p>
      <p>Certification cost {{ range(r.costMinCents, r.costMaxCents) }}</p>
      <p class="total">All-in total {{ range(r.allInMinCents, r.allInMaxCents) }}</p>
    </section>

    <section aria-labelledby="findings-title">
      <h2 id="findings-title">Findings</h2>
      <ul aria-label="Findings" class="findings">
        @for (f of r.findings; track f.id) {
          <li>
            <div class="head">
              <span class="title">{{ f.title }}</span>
              <span class="status" [attr.data-status]="f.status">{{ f.status }}</span>
              <span class="cost">{{ cost(f) }}</span>
            </div>
            @if (f.note) {
              <p class="note">{{ f.note }}</p>
            }
          </li>
        }
      </ul>
    </section>

    @if (r.bodyShop.status === 'InProgress' || r.bodyShop.status === 'Ready') {
      <section aria-label="Body shop review">
        <h2>Body shop review</h2>
        @if (r.bodyShop.status === 'InProgress') {
          <p class="state">In progress</p>
          <p>{{ first(r.bodyShop.reviewerName) }} is finishing the body review</p>
          <p class="note">It’s usually ready 30 minutes after the mechanic’s.</p>
        } @else {
          <ul aria-label="Body shop findings" class="findings">
            @for (f of r.bodyShop.findings; track f.id) {
              <li>
                <div class="head">
                  <span class="title">{{ f.title }}</span>
                  <span class="status" [attr.data-status]="f.status">{{ f.status }}</span>
                  <span class="cost">{{ cost(f) }}</span>
                </div>
                @if (f.note) {
                  <p class="note">{{ f.note }}</p>
                }
              </li>
            }
          </ul>
          <p class="note">
            Body repairs are separate from the safety certification estimate above.
          </p>
        }
      </section>
    }

    <p class="disclaimer">{{ r.disclaimer }}</p>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--spacingVerticalXXL);
    }
    h2,
    p {
      margin: 0;
    }
    section {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    .range {
      font-size: var(--fontSizeBase500);
      font-weight: var(--fontWeightSemibold);
    }
    .total {
      font-weight: var(--fontWeightSemibold);
    }
    .findings {
      display: grid;
      gap: var(--spacingVerticalM);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .findings li {
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
      align-items: baseline;
    }
    .title {
      flex: 1 1 12rem;
      font-weight: var(--fontWeightSemibold);
      overflow-wrap: anywhere;
    }
    .status {
      color: var(--colorNeutralForeground2);
    }
    .status[data-status='Required'] {
      color: var(--colorStatusDangerForeground1);
      font-weight: var(--fontWeightSemibold);
    }
    .status[data-status='Passes'] {
      color: var(--colorStatusSuccessForeground1);
    }
    .note,
    .state {
      color: var(--colorNeutralForeground2);
      overflow-wrap: anywhere;
    }
    .disclaimer {
      color: var(--colorNeutralForeground2);
      font-size: var(--fontSizeBase300);
    }
  `,
})
export class ReportView {
  readonly report = input.required<Report>();

  protected readonly money = dollars;
  protected readonly range = dollarRange;

  protected cost(f: Finding) {
    return f.minCents !== null && f.maxCents !== null ? dollarRange(f.minCents, f.maxCents) : '—';
  }

  protected first(name: string | null) {
    return name?.split(' ')[0] ?? 'The body shop';
  }
}

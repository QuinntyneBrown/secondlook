import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiProblem, REPORTS_API, Report } from 'api';
import { Alert } from 'components';
import { ReportView } from '../ui/report-view';
import { dayLabel } from '../util/eastern-time';

type Load = 'loading' | 'ready' | 'not-shared' | 'failed';

/** What someone with a share link reads, with no account (L2-047). It is read-only and shows no way to act. */
@Component({
  selector: 'sl-shared-report-page',
  imports: [Alert, ReportView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page" [attr.aria-busy]="state() === 'loading' ? 'true' : null">
      @switch (state()) {
        @case ('ready') {
          @let r = report()!;
          <h1>Shared report</h1>
          <p class="sub">
            A read-only copy of a SecondLook report. Call finished {{ finished(r) }} ·
            {{ author(r) }}
          </p>
          <p class="sub">
            {{ r.vehicleName }} ·
            @if (r.vin && r.vin !== r.vehicleName) {
              VIN {{ r.vin }} ·
            }
            {{ r.odometerKm.toLocaleString('en-CA') }} km
          </p>
          <sl-report-view [report]="r" />
        }
        @case ('not-shared') {
          <sl-alert
            variant="danger"
            title="This report isn’t shared with you"
            text="The owner turned off the link. Ask them for a new one."
          />
        }
        @case ('failed') {
          <sl-alert
            variant="danger"
            title="We couldn’t load this report"
            text="Try again in a moment."
          />
        }
        @default {
          <p role="status">Loading the report…</p>
        }
      }
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
      width: min(720px, 100%);
    }
    h1,
    p {
      margin: 0;
    }
    .sub {
      color: var(--colorNeutralForeground2);
    }
  `,
})
export class SharedReportPage implements OnInit {
  private readonly api = inject(REPORTS_API);
  private readonly token = inject(ActivatedRoute).snapshot.paramMap.get('token') ?? '';

  protected readonly state = signal<Load>('loading');
  protected readonly report = signal<Report | null>(null);

  ngOnInit() {
    this.api.getShared(this.token).subscribe({
      next: (r) => {
        this.report.set(r);
        this.state.set('ready');
      },
      error: (p: ApiProblem) => this.state.set(p.status === 404 ? 'not-shared' : 'failed'),
    });
  }

  /** "written by" the mechanic, or "reviewed by" the body shop when it is the only author. */
  protected author(r: Report) {
    return r.mechanicName
      ? `written by ${r.mechanicName}`
      : `reviewed by ${r.bodyShop.reviewerName ?? 'the body shop'}`;
  }

  protected finished(r: Report) {
    return dayLabel(r.callEndedAt ?? r.submittedAt);
  }
}

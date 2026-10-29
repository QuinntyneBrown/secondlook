import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiProblem, REPORTS_API, Report } from 'api';
import { Alert, Button } from 'components';
import { BuyerNav } from '../booking/booking-chrome';
import { DownloadReportDialog } from '../dialogs/download-report-dialog';
import { ReportIssueDialog } from '../dialogs/report-issue-dialog';
import { ShareReportDialog } from '../dialogs/share-report-dialog';
import { ReportView } from '../ui/report-view';
import { dayLabel } from '../util/eastern-time';

type Load = 'loading' | 'ready' | 'not-ready' | 'not-found' | 'failed';

/** The buyer's safety certification estimate (L2-045, L2-046) with its share, download and issue actions. */
@Component({
  selector: 'sl-report-page',
  imports: [Alert, Button, BuyerNav, ReportView, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-buyer-nav />
    <main class="page" [attr.aria-busy]="state() === 'loading' ? 'true' : null">
      @switch (state()) {
        @case ('ready') {
          @let r = report()!;
          <h1>Your report</h1>
          <p class="sub">Call finished {{ finished(r) }} · {{ author(r) }}</p>
          <p class="sub">
            {{ r.vehicleName }} ·
            @if (r.vin && r.vin !== r.vehicleName) {
              VIN {{ r.vin }} ·
            }
            {{ r.odometerKm.toLocaleString('en-CA') }} km
          </p>
          <div class="actions">
            <sl-button variant="outline" (pressed)="share(r)">Share</sl-button>
            <sl-button variant="outline" (pressed)="download()">Download report</sl-button>
            <sl-button variant="outline" (pressed)="issue(r)">Report an issue</sl-button>
            <sl-button variant="outline" routerLink="/compare">Compare with another car</sl-button>
          </div>
          <sl-report-view [report]="r" />
        }
        @case ('not-ready') {
          <h1>Your report</h1>
          <sl-alert
            variant="info"
            title="Your report isn’t ready yet"
            text="The mechanic is still writing it. It will be here, in your account, once it’s sent."
          >
            <a routerLink="/inspections">Back to inspections</a>
          </sl-alert>
        }
        @case ('not-found') {
          <sl-alert
            variant="danger"
            title="We couldn’t find that report"
            text="Check the link, or open it from your inspections."
          >
            <a routerLink="/inspections">Back to inspections</a>
          </sl-alert>
        }
        @case ('failed') {
          <sl-alert
            variant="danger"
            title="Your report didn’t load"
            text="It’s safe in your account. Try again, or download a copy once it opens."
          >
            <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
            <a routerLink="/inspections">Back to inspections</a>
          </sl-alert>
        }
        @default {
          <p role="status">Loading your report…</p>
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
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class ReportPage implements OnInit {
  private readonly api = inject(REPORTS_API);
  private readonly dialog = inject(Dialog);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly state = signal<Load>('loading');
  protected readonly report = signal<Report | null>(null);

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.state.set('loading');
    this.api.get(this.id).subscribe({
      next: (r) => {
        this.report.set(r);
        this.state.set('ready');
      },
      error: (p: ApiProblem) =>
        this.state.set(p.status === 404 ? 'not-found' : p.status === 409 ? 'not-ready' : 'failed'),
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

  protected share(r: Report) {
    this.dialog.open(ShareReportDialog, {
      data: { inspectionId: this.id, hasBodyShop: r.bodyShop.status !== 'NotRequested' },
      ariaLabelledBy: 'share-title',
      backdropClass: 'sl-dialog-backdrop',
    });
  }

  protected download() {
    this.dialog.open(DownloadReportDialog, {
      data: this.id,
      ariaLabelledBy: 'download-title',
      backdropClass: 'sl-dialog-backdrop',
    });
  }

  protected issue(r: Report) {
    this.dialog.open(ReportIssueDialog, {
      data: {
        inspectionId: this.id,
        mechanicFirstName: (r.mechanicName ?? r.bodyShop.reviewerName ?? 'The reviewer').split(
          ' ',
        )[0],
      },
      ariaLabelledBy: 'issue-title',
      backdropClass: 'sl-dialog-backdrop',
    });
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ApiProblem, REPORTS_API, ReportShare } from 'api';
import { Alert, Button } from 'components';

export interface ShareReportData {
  inspectionId: string;
  /** Whether the report has a body shop review the buyer can leave out. */
  hasBodyShop: boolean;
}

type View = 'form' | 'sent' | 'failed' | 'off';

/** Shares the report by email and by link (L2-047). Opened with the CDK Dialog. */
@Component({
  selector: 'sl-share-report-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="share-title">Share this report</h2>
      @switch (view()) {
        @case ('sent') {
          <p>Report sent to {{ sentTo() }}</p>
          <p class="hint">
            They can read it without an account. You can turn the link off from this dialog.
          </p>
          <div class="actions">
            <sl-button variant="outline" [busy]="busy()" (pressed)="turnOff()"
              >Turn off link</sl-button
            >
            <sl-button (pressed)="ref.close()">Done</sl-button>
          </div>
        }
        @case ('off') {
          <p role="status">The link is turned off.</p>
          <p class="hint">Anyone who opens it will be told the report isn’t shared with them.</p>
          <div class="actions">
            <sl-button (pressed)="ref.close()">Done</sl-button>
          </div>
        }
        @case ('failed') {
          <sl-alert
            variant="danger"
            title="We couldn’t send it"
            text="The email didn’t go out. Copy the link instead, or try again."
          >
            <sl-button variant="outline" (pressed)="view.set('form')">Try again</sl-button>
          </sl-alert>
          <div class="actions">
            <sl-button variant="outline" (pressed)="ref.close()">Close</sl-button>
          </div>
        }
        @default {
          <p class="hint">Send it to the seller or a friend who knows cars.</p>
          <div class="field">
            <label for="send-to">Send to</label>
            <input
              id="send-to"
              type="email"
              autocomplete="off"
              [value]="email()"
              [attr.aria-invalid]="problem() ? 'true' : null"
              (input)="email.set($any($event.target).value)"
            />
            @if (problem(); as p) {
              <p class="problem">{{ p }}</p>
            }
          </div>
          @if (data.hasBodyShop) {
            <label class="check">
              <input
                type="checkbox"
                [checked]="includeBodyShop()"
                (change)="toggleBodyShop($any($event.target).checked)"
              />
              Include the body shop review
            </label>
          }
          <div class="field">
            <label for="share-link">Share link</label>
            <div class="row">
              <input id="share-link" type="text" readonly [value]="absoluteLink()" />
              <sl-button variant="outline" (pressed)="copy()">{{
                copied() ? 'Copied' : 'Copy link'
              }}</sl-button>
            </div>
            <p class="hint">Works for 14 days. Turn it off any time.</p>
          </div>
          <div class="actions">
            <sl-button variant="outline" (pressed)="ref.close()">Cancel</sl-button>
            <sl-button [busy]="busy()" [disabled]="!share()" (pressed)="send()"
              >Send report</sl-button
            >
          </div>
        }
      }
    </div>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(480px, 100vw - 32px);
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
    .hint {
      color: var(--colorNeutralForeground2);
    }
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    .row {
      display: flex;
      gap: var(--spacingHorizontalM);
    }
    .row input {
      flex: 1;
    }
    input[type='email'],
    input[type='text'] {
      font: inherit;
      min-height: 36px;
      padding: var(--spacingVerticalS) var(--spacingHorizontalM);
    }
    .check {
      display: flex;
      gap: var(--spacingHorizontalS);
      align-items: center;
    }
    .problem {
      color: var(--colorStatusDangerForeground1);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class ShareReportDialog implements OnInit {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<ShareReportData>(DIALOG_DATA);
  private readonly api = inject(REPORTS_API);

  protected readonly view = signal<View>('form');
  protected readonly share = signal<ReportShare | null>(null);
  protected readonly email = signal('');
  protected readonly problem = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly copied = signal(false);
  protected readonly includeBodyShop = signal(true);
  protected readonly sentTo = signal('');

  ngOnInit() {
    this.update();
  }

  protected absoluteLink() {
    const s = this.share();
    return s ? `${location.origin}${s.link}` : 'Making your link…';
  }

  private update() {
    this.api.share(this.data.inspectionId, this.includeBodyShop()).subscribe({
      next: (s) => this.share.set(s),
      error: () => this.problem.set('We couldn’t make a link. Try again in a moment.'),
    });
  }

  protected toggleBodyShop(on: boolean) {
    this.includeBodyShop.set(on);
    this.update();
  }

  protected copy() {
    void navigator.clipboard?.writeText(this.absoluteLink()).then(() => this.copied.set(true));
  }

  protected send() {
    this.busy.set(true);
    this.problem.set(null);
    const email = this.email().trim();
    this.api.emailShare(this.data.inspectionId, email).subscribe({
      next: () => {
        this.busy.set(false);
        this.sentTo.set(email.toLowerCase());
        this.view.set('sent');
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        const message = p.errors?.['email']?.[0];
        if (p.status === 400 && message) this.problem.set(message);
        else this.view.set('failed');
      },
    });
  }

  protected turnOff() {
    this.busy.set(true);
    this.api.turnOffShare(this.data.inspectionId).subscribe({
      next: () => {
        this.busy.set(false);
        this.view.set('off');
      },
      error: () => this.busy.set(false),
    });
  }
}

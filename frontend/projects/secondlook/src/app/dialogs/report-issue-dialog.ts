import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiProblem, IssueReason, REPORTS_API } from 'api';
import { Alert, Button } from 'components';

export interface ReportIssueData {
  inspectionId: string;
  mechanicFirstName: string;
}

type View = 'form' | 'sent' | 'failed';

/** The buyer asks the mechanic to look again (L2-049). Opened with the CDK Dialog. */
@Component({
  selector: 'sl-report-issue-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="issue-title">Report an issue</h2>
      @switch (view()) {
        @case ('sent') {
          <p>Thanks. {{ data.mechanicFirstName }} will take another look.</p>
          <p class="hint">We’ve passed it on. If something changes, we’ll update the report.</p>
          <div class="actions">
            <sl-button (pressed)="ref.close()">Done</sl-button>
          </div>
        }
        @case ('failed') {
          <sl-alert
            variant="danger"
            title="We couldn’t send that"
            text="Nothing was lost. Try again."
          >
            <sl-button variant="outline" (pressed)="view.set('form')">Try again</sl-button>
          </sl-alert>
        }
        @default {
          <p class="hint">Think the mechanic got something wrong? Tell us and they’ll review it.</p>
          <fieldset>
            <legend>What’s wrong?</legend>
            @for (c of choices; track c.value) {
              <label>
                <input
                  type="radio"
                  name="reason"
                  [value]="c.value"
                  [checked]="reason() === c.value"
                  (change)="reason.set(c.value)"
                />
                {{ c.label }}
              </label>
            }
            @if (problem(); as p) {
              <p class="problem">{{ p }}</p>
            }
          </fieldset>
          <div class="field">
            <label for="more">Tell us more (optional)</label>
            <textarea
              id="more"
              rows="3"
              [value]="details()"
              (input)="details.set($any($event.target).value)"
            ></textarea>
          </div>
          <div class="actions">
            <sl-button variant="outline" (pressed)="ref.close()">Cancel</sl-button>
            <sl-button [busy]="busy()" (pressed)="send()">Send</sl-button>
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
    fieldset {
      display: grid;
      gap: var(--spacingVerticalS);
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      padding: 0;
      margin-bottom: var(--spacingVerticalS);
      font-weight: var(--fontWeightSemibold);
    }
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    textarea {
      font: inherit;
      padding: var(--spacingVerticalS) var(--spacingHorizontalM);
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
export class ReportIssueDialog {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  protected readonly data = inject<ReportIssueData>(DIALOG_DATA);
  private readonly api = inject(REPORTS_API);

  protected readonly choices: { value: IssueReason; label: string }[] = [
    { value: 'FindingLooksWrong', label: 'A finding looks wrong' },
    { value: 'SomethingMissed', label: 'Something was missed' },
    { value: 'CostSeemsOff', label: 'The cost seems off' },
    { value: 'SomethingElse', label: 'Something else' },
  ];
  protected readonly view = signal<View>('form');
  protected readonly reason = signal<IssueReason | ''>('');
  protected readonly details = signal('');
  protected readonly problem = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected send() {
    if (!this.reason()) {
      this.problem.set('Choose what’s wrong.');
      return;
    }
    this.problem.set(null);
    this.busy.set(true);
    this.api.reportIssue(this.data.inspectionId, this.reason(), this.details().trim()).subscribe({
      next: () => {
        this.busy.set(false);
        this.view.set('sent');
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        const message = p.errors?.['reason']?.[0];
        if (p.status === 400 && message) this.problem.set(message);
        else this.view.set('failed');
      },
    });
  }
}

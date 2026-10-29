import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { REPORTS_API } from 'api';
import { Alert, Button } from 'components';

/** Downloads a PDF copy of the report (L2-048). Opened with the CDK Dialog. */
@Component({
  selector: 'sl-download-report-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="download-title">Download the report</h2>
      <p class="hint">A copy for your records, or for the seller.</p>
      <fieldset [disabled]="busy()">
        <legend class="vh">Format</legend>
        <label>
          <input type="radio" name="format" checked />
          PDF
        </label>
        <label>
          <input type="radio" name="format" disabled aria-describedby="screens-hint" />
          PDF with call screenshots
        </label>
        <p id="screens-hint" class="hint">Not available yet: calls aren’t recorded.</p>
      </fieldset>
      @if (busy()) {
        <p role="status">Preparing your PDF…</p>
      }
      @if (failed()) {
        <sl-alert
          variant="danger"
          title="We couldn’t make the PDF"
          text="The report is fine. Try again in a moment."
        >
          <sl-button variant="outline" (pressed)="download()">Try again</sl-button>
        </sl-alert>
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Close</sl-button>
        <sl-button [busy]="busy()" (pressed)="download()">Download PDF</sl-button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(440px, 100vw - 32px);
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
    .vh {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class DownloadReportDialog {
  protected readonly ref = inject<DialogRef<void>>(DialogRef);
  private readonly inspectionId = inject<string>(DIALOG_DATA);
  private readonly api = inject(REPORTS_API);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected download() {
    this.busy.set(true);
    this.failed.set(false);
    this.api.pdf(this.inspectionId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'secondlook-report.pdf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        this.ref.close();
      },
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

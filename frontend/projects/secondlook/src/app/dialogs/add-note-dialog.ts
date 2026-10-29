import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CALLS_API, CallState } from 'api';
import { Alert, Button } from 'components';

/** The mechanic adds a note the others on the call can read (L2-041). Opened with the CDK Dialog. */
@Component({
  selector: 'sl-add-note-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="add-note-title">Add a note</h2>
      <label for="note"
        >Note
        <textarea
          id="note"
          rows="4"
          maxlength="500"
          [value]="text()"
          (input)="text.set($any($event.target).value)"
        ></textarea>
      </label>
      @if (failed()) {
        <sl-alert title="We couldn’t add that note" text="Try again in a moment." />
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button [busy]="busy()" [disabled]="!text().trim()" (pressed)="add()"
          >Add note</sl-button
        >
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
    h2 {
      margin: 0;
    }
    label {
      display: grid;
      gap: var(--spacingVerticalXS);
    }
    textarea {
      font: inherit;
      padding: var(--spacingVerticalS) var(--spacingHorizontalM);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class AddNoteDialog {
  protected readonly ref = inject<DialogRef<CallState>>(DialogRef);
  private readonly api = inject(CALLS_API);
  private readonly inspectionId = inject<string>(DIALOG_DATA);
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected add() {
    this.busy.set(true);
    this.failed.set(false);
    this.api.addNote(this.inspectionId, this.text().trim()).subscribe({
      next: (state) => this.ref.close(state),
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

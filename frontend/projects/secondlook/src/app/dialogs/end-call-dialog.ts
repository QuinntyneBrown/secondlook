import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Button } from 'components';

export interface EndCallData {
  /** Who is still on the call and will be disconnected. */
  others: string[];
  /** Checklist items that are not done yet. */
  left: string[];
}

/** Confirms ending the call for everyone (L2-043). "Stay on the call" has focus, so a stray key cannot end it. */
@Component({
  selector: 'sl-end-call-dialog',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="end-call-title">End the call for everyone?</h2>
      <div id="end-call-description" class="body">
        <p>
          {{
            others.length ? others.join(' and ') + ' will be disconnected.' : 'The call will end.'
          }}
        </p>
        @if (data.left.length) {
          <p>Left on the checklist: {{ data.left.join(', ') }}</p>
        }
      </div>
      <div class="actions">
        <sl-button class="stay" variant="outline" (pressed)="ref.close(false)"
          >Stay on the call</sl-button
        >
        <sl-button (pressed)="ref.close(true)">End call</sl-button>
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
    .body {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class EndCallDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<EndCallData>(DIALOG_DATA);
  protected readonly others = this.data.others;
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiProblem, AVAILABILITY_API, AvailabilityWindow } from 'api';
import { Alert, Button } from 'components';
import { dayLabel, timeLabel } from '../util/eastern-time';

export interface RemoveWindowData {
  window: AvailabilityWindow;
}

/** Confirms removing a window; "Cancel" is the focused safe action (L2-065). A booked time blocks removal. */
@Component({
  selector: 'sl-remove-window-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="remove-title">Remove {{ label }}?</h2>
      <p id="remove-description">
        Buyers will no longer see these times. Bookings already made are not affected.
      </p>
      @if (problem(); as p) {
        <sl-alert [title]="p.title" [text]="p.text" />
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close(false)"
          >Cancel</sl-button
        >
        <sl-button [busy]="busy()" (pressed)="confirm()">{{
          busy() ? 'Removing' : 'Remove'
        }}</sl-button>
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
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class RemoveWindowDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly data = inject<RemoveWindowData>(DIALOG_DATA);
  private readonly api = inject(AVAILABILITY_API);
  protected readonly busy = signal(false);
  protected readonly problem = signal<{ title: string; text: string } | null>(null);

  protected readonly label = `${dayLabel(this.data.window.start)}, ${timeLabel(this.data.window.start)} – ${timeLabel(this.data.window.end)}`;

  protected confirm() {
    this.busy.set(true);
    this.problem.set(null);
    this.api.remove(this.data.window.id).subscribe({
      next: () => this.ref.close(true),
      error: (p: ApiProblem) => {
        this.busy.set(false);
        this.problem.set(
          p.status === 409
            ? {
                title: 'That time is already booked',
                text: 'A booking falls inside this time. Handle the booking first, then remove it.',
              }
            : {
                title: 'We couldn’t remove that',
                text: 'Something went wrong on our side. Nothing was changed. Try again.',
              },
        );
      },
    });
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiProblem, AVAILABILITY_API, AvailabilityWindow } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';
import { easternToUtc, utcToEastern } from '../util/eastern-time';

export interface WindowDialogData {
  /** Present when editing an existing window. */
  window?: AvailabilityWindow;
}

/** Adds or edits an availability window in Eastern Time (L2-061). Opened with the CDK Dialog (L2-065). */
@Component({
  selector: 'sl-window-dialog',
  imports: [FormField, Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="window-title">{{ editing ? 'Edit availability' : 'Add availability' }}</h2>
      <p id="window-description">Set when you can take inspections.</p>
      @if (summary().length) {
        <sl-alert
          [title]="
            'Fix ' +
            summary().length +
            (summary().length === 1 ? ' thing' : ' things') +
            ' to continue'
          "
          [items]="summary()"
          [focusOnShow]="true"
        />
      }
      @if (problem(); as p) {
        <sl-alert [title]="p.title" [text]="p.text" />
      }
      <sl-form-field
        fieldId="w-day"
        label="Day"
        type="date"
        [error]="errors()['w-day']"
        [readonly]="busy()"
        [(value)]="day"
      />
      <sl-form-field
        fieldId="w-start"
        label="Start (Eastern Time)"
        type="time"
        [error]="errors()['w-start']"
        [readonly]="busy()"
        [(value)]="start"
      />
      <sl-form-field
        fieldId="w-end"
        label="End (Eastern Time)"
        type="time"
        [error]="errors()['w-end']"
        [readonly]="busy()"
        [(value)]="end"
      />
      <p class="help">
        Buyers can book 30-minute slots inside this window. Times use the Eastern Time zone.
      </p>
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Saving' : editing ? 'Save changes' : 'Save'
        }}</sl-button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(440px, 100vw - 32px);
      max-height: calc(100dvh - 32px);
      overflow: auto;
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
    .help {
      color: var(--colorNeutralForeground3);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class WindowDialog {
  protected readonly ref = inject<DialogRef<AvailabilityWindow>>(DialogRef);
  private readonly data = inject<WindowDialogData>(DIALOG_DATA);
  private readonly api = inject(AVAILABILITY_API);

  protected readonly editing = !!this.data.window;
  protected readonly day = signal('');
  protected readonly start = signal('');
  protected readonly end = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal<{ title: string; text: string } | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  constructor() {
    const w = this.data.window;
    if (w) {
      const s = utcToEastern(w.start);
      this.day.set(s.day);
      this.start.set(s.time);
      this.end.set(utcToEastern(w.end).time);
    }
  }

  private static onHalfHour(time: string) {
    return /^\d{2}:(00|30)$/.test(time);
  }

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.problem.set(null);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    const add = (id: string, message: string) => {
      errors[id] = message;
      items.push({ message, fieldId: id });
    };
    if (!this.day()) add('w-day', 'Choose a day.');
    if (!this.start()) add('w-start', 'Choose a start time.');
    else if (!WindowDialog.onHalfHour(this.start()))
      add('w-start', 'Start on the hour or half hour.');
    if (!this.end()) add('w-end', 'Choose an end time.');
    else if (this.start() && this.end() <= this.start())
      add('w-end', 'End must be after the start.');
    else if (!WindowDialog.onHalfHour(this.end())) add('w-end', 'End on the hour or half hour.');
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    const start = easternToUtc(this.day(), this.start());
    const end = easternToUtc(this.day(), this.end());
    if (!start || !end) return;

    this.busy.set(true);
    const call = this.data.window
      ? this.api.update(this.data.window.id, start, end)
      : this.api.add(start, end);
    call.subscribe({
      next: (saved) => this.ref.close(saved),
      error: (p: ApiProblem) => {
        this.busy.set(false);
        if (p.status === 409)
          this.problem.set({
            title: p.title,
            text:
              p.title === 'That time is already booked'
                ? 'A booking falls inside this time. Handle the booking first.'
                : 'That time overlaps a window you already saved. Pick a different time.',
          });
        else if (p.status === 400 && p.errors) {
          const server: SummaryItem[] = [];
          const mapped: Record<string, string> = {};
          for (const [field, id] of [
            ['start', 'w-start'],
            ['end', 'w-end'],
          ] as const) {
            const message = p.errors[field]?.[0];
            if (message) {
              mapped[id] = message;
              server.push({ message, fieldId: id });
            }
          }
          this.errors.set(mapped);
          queueMicrotask(() => this.summary.set(server));
        } else
          this.problem.set({
            title: 'We couldn’t save that',
            text: 'Something went wrong on our side. Nothing was saved. Try again.',
          });
      },
    });
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiProblem, BOOKINGS_API, Inspection, Slot } from 'api';
import { Alert, Button } from 'components';
import { dayChip, longWeekday, timeLabel } from '../util/eastern-time';

export interface RescheduleData {
  inspection: Inspection;
}

/** Moves the call to another free time of the same mechanic (L2-036, ADR 0009). Opened with the CDK Dialog (L2-065). */
@Component({
  selector: 'sl-reschedule-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="reschedule-title">Pick a new time</h2>
      <p id="reschedule-description">
        {{ data.inspection.mechanicName }} is free at these times. The seller gets a new text.
      </p>
      @if (problem()) {
        <sl-alert
          title="We couldn’t move the call"
          text="Your original time is still booked. Try again."
        >
          <sl-button variant="outline" (pressed)="submit()">Try again</sl-button>
        </sl-alert>
      }
      @if (loading()) {
        <p role="status">Finding free times…</p>
      } @else if (days().length === 0) {
        <p>No other times are free right now. Your original time is still booked.</p>
      } @else {
        <div class="chips" role="group" aria-label="Day">
          @for (d of days(); track d.chip) {
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="d.chip === dayChoice()"
              (click)="pickDay(d.chip)"
            >
              {{ d.chip }}
            </button>
          }
        </div>
        @if (selectedDay(); as day) {
          <h3>{{ day.long }}</h3>
          <div class="chips" role="group" aria-label="Time">
            @for (s of day.slots; track s.start) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="s.start === slot()?.start"
                (click)="pickSlot(s)"
              >
                {{ time(s) }}
              </button>
            }
          </div>
        }
      }
      @if (needTime()) {
        <p class="error" id="reschedule-error">Choose a new time.</p>
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Rescheduling' : 'Reschedule'
        }}</sl-button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(520px, 100vw - 32px);
      max-height: calc(100dvh - 32px);
      overflow: auto;
      padding: var(--spacingVerticalXXL);
      border-radius: var(--borderRadiusLarge);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font-family: var(--fontFamilyBase);
    }
    h2,
    h3,
    p {
      margin: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalS);
    }
    .chip {
      min-height: 40px;
      padding: 0 var(--spacingHorizontalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke1);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font: inherit;
      cursor: pointer;
    }
    .chip[aria-pressed='true'] {
      border-color: var(--colorBrandStroke1);
      background: var(--colorBrandBackground);
      color: var(--colorNeutralForegroundOnBrand);
    }
    .error {
      color: var(--colorStatusDangerForeground1);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class RescheduleDialog {
  protected readonly ref = inject<DialogRef<Inspection>>(DialogRef);
  protected readonly data = inject<RescheduleData>(DIALOG_DATA);
  private readonly api = inject(BOOKINGS_API);

  protected readonly loading = signal(true);
  protected readonly slots = signal<Slot[]>([]);
  protected readonly dayChoice = signal<string | null>(null);
  protected readonly slot = signal<Slot | null>(null);
  protected readonly busy = signal(false);
  protected readonly problem = signal(false);
  protected readonly needTime = signal(false);
  protected readonly time = (s: Slot) => timeLabel(s.start);

  protected readonly days = computed(() => {
    const map = new Map<string, { chip: string; long: string; slots: Slot[] }>();
    for (const s of this.slots()) {
      const chip = dayChip(s.start);
      const day = map.get(chip) ?? { chip, long: longWeekday(s.start), slots: [] };
      if (!day.slots.some((x) => x.start === s.start)) day.slots.push(s);
      map.set(chip, day);
    }
    return [...map.values()];
  });
  protected readonly selectedDay = computed(
    () => this.days().find((d) => d.chip === this.dayChoice()) ?? null,
  );

  constructor() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.rescheduleSlots(this.data.inspection.id).subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.dayChoice.set(this.days()[0]?.chip ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.slots.set([]);
        this.loading.set(false);
      },
    });
  }

  protected pickDay(chip: string) {
    this.dayChoice.set(chip);
    this.slot.set(null);
  }

  protected pickSlot(s: Slot) {
    this.needTime.set(false);
    this.slot.set(s);
  }

  protected submit(event?: Event) {
    event?.preventDefault();
    if (this.busy()) return;
    const s = this.slot();
    if (!s) {
      this.needTime.set(true);
      return;
    }
    this.busy.set(true);
    this.problem.set(false);
    this.api.reschedule(this.data.inspection.id, s.start).subscribe({
      next: (moved) => this.ref.close(moved),
      error: (p: ApiProblem) => {
        this.busy.set(false);
        this.problem.set(true);
        if (p.status === 409) this.load();
      },
    });
  }
}

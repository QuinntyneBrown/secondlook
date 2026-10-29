import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FindingInput, FindingStatus } from 'api';
import { Button } from 'components';

/** The mechanic adds one finding to the estimate (L2-050). Opened with the CDK Dialog; returns the finding. */
@Component({
  selector: 'sl-finding-dialog',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="finding-title">Add a finding</h2>
      <div class="field">
        <label for="title">Title</label>
        <input id="title" type="text" [value]="title()" (input)="title.set(value($event))" />
        @if (problems().title; as p) {
          <p class="problem">{{ p }}</p>
        }
      </div>
      <div class="field">
        <label for="note">Note (optional)</label>
        <textarea id="note" rows="3" [value]="note()" (input)="note.set(value($event))"></textarea>
      </div>
      <div class="field">
        <label for="status">Status</label>
        <select id="status" (change)="status.set($any(value($event)))">
          @for (s of statuses; track s) {
            <option [value]="s" [selected]="s === status()">{{ s }}</option>
          }
        </select>
      </div>
      <div class="costs">
        <div class="field">
          <label for="min">Lowest cost ($)</label>
          <input
            id="min"
            type="text"
            inputmode="decimal"
            [value]="min()"
            (input)="min.set(value($event))"
          />
        </div>
        <div class="field">
          <label for="max">Highest cost ($)</label>
          <input
            id="max"
            type="text"
            inputmode="decimal"
            [value]="max()"
            (input)="max.set(value($event))"
          />
        </div>
      </div>
      @if (problems().cost; as p) {
        <p class="problem">{{ p }}</p>
      }
      <div class="actions">
        <sl-button variant="outline" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button (pressed)="add()">Add finding</sl-button>
      </div>
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
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    .costs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--spacingHorizontalM);
    }
    input,
    textarea,
    select {
      font: inherit;
      min-height: 36px;
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
export class FindingDialog {
  protected readonly ref = inject<DialogRef<FindingInput>>(DialogRef);
  protected readonly statuses: FindingStatus[] = ['Required', 'Recommended', 'Passes'];
  protected readonly title = signal('');
  protected readonly note = signal('');
  protected readonly status = signal<FindingStatus>('Required');
  protected readonly min = signal('');
  protected readonly max = signal('');
  protected readonly problems = signal<{ title?: string; cost?: string }>({});

  protected value(e: Event) {
    return (e.target as HTMLInputElement).value;
  }

  protected add() {
    const title = this.title().trim();
    const problems: { title?: string; cost?: string } = {};
    if (title.length === 0 || title.length > 200) {
      problems.title = 'Give the finding a title of up to 200 characters.';
    }
    const lo = this.min().trim();
    const hi = this.max().trim();
    let minCents: number | null = null;
    let maxCents: number | null = null;
    if (lo || hi) {
      if (!lo || !hi) {
        problems.cost = 'Give both ends of the cost range, or neither.';
      } else {
        minCents = Math.round(Number(lo.replace(/[$,]/g, '')) * 100);
        maxCents = Math.round(Number(hi.replace(/[$,]/g, '')) * 100);
        if (
          !Number.isFinite(minCents) ||
          !Number.isFinite(maxCents) ||
          minCents < 0 ||
          maxCents < minCents ||
          maxCents > 10_000_000
        ) {
          problems.cost = 'Use a cost range from zero up to $100,000, lowest first.';
        } else if (this.status() === 'Passes') {
          problems.cost = 'A finding that passes has no cost.';
        }
      }
    }
    this.problems.set(problems);
    if (problems.title || problems.cost) return;
    this.ref.close({ title, note: this.note().trim(), status: this.status(), minCents, maxCents });
  }
}

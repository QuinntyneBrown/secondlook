import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiProblem, FindingInput, REPORTS_API } from 'api';
import { Alert, Button } from 'components';
import { FindingDialog } from '../dialogs/finding-dialog';
import { dollarRange } from '../util/money';

/** The mechanic writes the estimate after the call (L2-050): findings are added in a dialog, then submitted. */
@Component({
  selector: 'sl-estimate-page',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Write the estimate</h1>
      <p class="sub">
        List what the car needs to pass a safety inspection, and what it will cost. The buyer reads
        this as their report.
      </p>

      @if (sent()) {
        <sl-alert
          variant="success"
          title="Estimate sent. The buyer can read it now."
          text="You can change it and send it again."
        />
      }
      @if (problem(); as p) {
        <sl-alert variant="danger" [title]="p" />
      }

      @if (findings().length) {
        <ul aria-label="Findings" class="findings">
          @for (f of findings(); track $index) {
            <li>
              <span class="title">{{ f.title }}</span>
              <span>{{ f.status }}</span>
              <span>{{ cost(f) }}</span>
              <sl-button variant="outline" (pressed)="remove($index)">Remove</sl-button>
            </li>
          }
        </ul>
      } @else {
        <p class="sub">No findings yet.</p>
      }

      <div class="actions">
        <sl-button variant="outline" (pressed)="add()">Add a finding</sl-button>
        <sl-button [busy]="busy()" (pressed)="submit()">Submit estimate</sl-button>
      </div>
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
    .findings {
      display: grid;
      gap: var(--spacingVerticalM);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .findings li {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
      align-items: center;
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .title {
      flex: 1 1 12rem;
      font-weight: var(--fontWeightSemibold);
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class EstimatePage implements OnInit {
  private readonly api = inject(REPORTS_API);
  private readonly dialog = inject(Dialog);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly findings = signal<FindingInput[]>([]);
  protected readonly problem = signal<string | null>(null);
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);

  /** An estimate already sent can be changed: its findings are loaded for editing. */
  ngOnInit() {
    this.api.get(this.id).subscribe({
      next: (r) =>
        this.findings.set(
          r.findings.map((f) => ({
            title: f.title,
            note: f.note,
            status: f.status,
            minCents: f.minCents,
            maxCents: f.maxCents,
          })),
        ),
      error: () => undefined,
    });
  }

  protected cost(f: FindingInput) {
    return f.minCents !== null && f.maxCents !== null ? dollarRange(f.minCents, f.maxCents) : '—';
  }

  protected add() {
    const ref = this.dialog.open<FindingInput>(FindingDialog, {
      ariaLabelledBy: 'finding-title',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((finding) => {
      if (!finding) return;
      this.findings.update((all) => [...all, finding]);
      this.sent.set(false);
      this.problem.set(null);
    });
  }

  protected remove(index: number) {
    this.findings.update((all) => all.filter((_, n) => n !== index));
    this.sent.set(false);
  }

  protected submit() {
    this.sent.set(false);
    if (this.findings().length === 0) {
      this.problem.set('Add at least one finding');
      return;
    }
    this.problem.set(null);
    this.busy.set(true);
    this.api.submit(this.id, this.findings()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        this.problem.set(
          p.status === 409
            ? 'Write the report once the call has ended.'
            : p.status === 404
              ? 'We couldn’t find that inspection.'
              : 'We couldn’t send the estimate. Try again in a moment.',
        );
      },
    });
  }
}

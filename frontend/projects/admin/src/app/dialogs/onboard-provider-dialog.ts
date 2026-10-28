import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ADMIN_PROVIDERS_API, ApiProblem, Provider, ProviderKind } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';

/** Onboards a mechanic or body shop. Opened with the CDK Dialog (modal, Escape closes), per L2-065. */
@Component({
  selector: 'sl-onboard-provider-dialog',
  imports: [FormField, Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog" novalidate (submit)="submit($event)">
      <h2 id="onboard-title">Onboard a provider</h2>
      <p id="onboard-description">Add a mechanic or body shop. They start as pending.</p>
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
      @if (failed()) {
        <sl-alert
          title="We couldn’t onboard the provider"
          text="Something went wrong on our side. Nothing was saved. Try again."
        />
      }
      @if (conflict()) {
        <sl-alert
          title="That email already belongs to another kind of account"
          text="Use a different email, or check the kind."
        />
      }
      <div class="field">
        <label for="o-kind">Kind</label>
        <select id="o-kind" [disabled]="busy()" (change)="kind.set($any($event.target).value)">
          <option value="Mechanic" [selected]="kind() === 'Mechanic'">Mechanic</option>
          <option value="BodyShop" [selected]="kind() === 'BodyShop'">Body shop</option>
        </select>
      </div>
      <sl-form-field
        fieldId="o-name"
        label="Name"
        [error]="errors()['o-name']"
        [readonly]="busy()"
        [(value)]="name"
      />
      <sl-form-field
        fieldId="o-email"
        label="Email"
        type="email"
        [error]="errors()['o-email']"
        [readonly]="busy()"
        [(value)]="email"
      />
      <sl-form-field
        fieldId="o-licence"
        label="Licence number"
        [error]="errors()['o-licence']"
        [readonly]="busy()"
        [(value)]="licence"
      />
      <sl-form-field
        fieldId="o-location"
        label="Location"
        [error]="errors()['o-location']"
        [readonly]="busy()"
        [(value)]="location"
      />
      <p class="help">
        We email the provider a link to set a password. They can’t take inspections until you
        approve them.
      </p>
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close()">Cancel</sl-button>
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Onboarding' : 'Onboard provider'
        }}</sl-button>
      </div>
    </form>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(480px, 100vw - 32px);
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
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    select {
      min-height: 40px;
      font: inherit;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class OnboardProviderDialog {
  protected readonly ref = inject<DialogRef<Provider>>(DialogRef);
  private readonly api = inject(ADMIN_PROVIDERS_API);

  protected readonly kind = signal<ProviderKind>('Mechanic');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly licence = signal('');
  protected readonly location = signal('');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);
  protected readonly conflict = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.failed.set(false);
    this.conflict.set(false);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    const add = (id: string, summary: string, field = summary) => {
      errors[id] = field;
      items.push({ message: summary, fieldId: id });
    };
    if (!this.name().trim()) add('o-name', 'Enter the provider’s name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(this.email().trim()))
      add(
        'o-email',
        'Enter a valid email address.',
        'Enter a valid email address, like name@example.com.',
      );
    if (!this.licence().trim()) add('o-licence', 'Enter the licence number.');
    if (!this.location().trim()) add('o-location', 'Enter the location.');
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    this.api
      .onboard({
        kind: this.kind(),
        displayName: this.name().trim(),
        email: this.email().trim(),
        licenceNumber: this.licence().trim(),
        location: this.location().trim(),
      })
      .subscribe({
        next: (provider) => this.ref.close(provider),
        error: (p: ApiProblem) => {
          this.busy.set(false);
          if (p.status === 409) this.conflict.set(true);
          else this.failed.set(true);
        },
      });
  }
}

import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ADMIN_PROVIDERS_API, Provider } from 'api';
import { Alert, Button } from 'components';

export interface ConfirmProviderData {
  action: 'approve' | 'deactivate';
  provider: Provider;
}

/** Confirms approving or deactivating a provider. Deactivation focuses "Cancel", the safe action (L2-065). */
@Component({
  selector: 'sl-confirm-provider-dialog',
  imports: [Alert, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="confirm-title">{{ title }}</h2>
      <p id="confirm-description">{{ description }}</p>
      @if (failed()) {
        <sl-alert
          title="We couldn’t make that change"
          text="Nothing was changed. Try again, or refresh the list."
        />
      }
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close(false)"
          >Cancel</sl-button
        >
        <sl-button [busy]="busy()" (pressed)="confirm()">{{
          busy() ? busyLabel : label
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
export class ConfirmProviderDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ConfirmProviderData>(DIALOG_DATA);
  private readonly api = inject(ADMIN_PROVIDERS_API);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected get title() {
    const name = this.data.provider.displayName;
    return this.data.action === 'approve' ? `Approve ${name}?` : `Deactivate ${name}?`;
  }

  protected get description() {
    return this.data.action === 'approve'
      ? 'They’ll be able to take new inspections as soon as you approve.'
      : 'They won’t be offered new inspections. Inspections already booked with them stay with them, and you can approve them again later.';
  }

  protected get label() {
    return this.data.action === 'approve' ? 'Approve' : 'Deactivate';
  }

  protected get busyLabel() {
    return this.data.action === 'approve' ? 'Approving' : 'Deactivating';
  }

  protected confirm() {
    this.busy.set(true);
    this.failed.set(false);
    const call =
      this.data.action === 'approve'
        ? this.api.approve(this.data.provider.id)
        : this.api.deactivate(this.data.provider.id);
    call.subscribe({
      next: () => this.ref.close(true),
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

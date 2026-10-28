import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AUTH_API } from 'api';
import { Button } from 'components';
import { Session } from '../session';

/** Confirms signing out (L2-013). Opened with the CDK Dialog, which makes it modal and closes it on Escape. */
@Component({
  selector: 'sl-sign-out-dialog',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <h2 id="sign-out-title">Sign out of SecondLook?</h2>
      <p id="sign-out-description">
        Your inspections and reports stay in your account. You’ll need your email and password to
        get back in.
      </p>
      <div class="actions">
        <sl-button variant="outline" [disabled]="busy()" (pressed)="ref.close(false)"
          >Cancel</sl-button
        >
        <sl-button [busy]="busy()" (pressed)="confirm()">Sign out</sl-button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(420px, 100vw - 32px);
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
export class SignOutDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  private readonly api = inject(AUTH_API);
  private readonly session = inject(Session);
  protected readonly busy = signal(false);

  protected confirm() {
    this.busy.set(true);
    const finish = () => {
      this.session.end();
      this.ref.close(true);
    };
    this.api.signOut().subscribe({ next: finish, error: finish });
  }
}

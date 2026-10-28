import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiProblem, AUTH_API } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';
import { Session } from '../session';
import { AuthLayout } from '../ui/auth-layout';

@Component({
  selector: 'sl-reset-password-page',
  imports: [AuthLayout, FormField, Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (done()) {
      <sl-auth-layout title="Choose a new password">
        <sl-alert
          variant="success"
          title="Password updated"
          text="You’re signed in. Your inspections are one tap away."
        />
        <sl-button routerLink="/inspections">Go to inspections</sl-button>
      </sl-auth-layout>
    } @else if (expired()) {
      <sl-auth-layout title="Choose a new password">
        <sl-alert
          title="That link has expired"
          text="Reset links work for 30 minutes. Ask for a new one and we’ll send it straight away."
        >
          <a routerLink="/forgot-password">Send a new link</a>
        </sl-alert>
      </sl-auth-layout>
    } @else {
      <sl-auth-layout title="Choose a new password">
        <form novalidate (submit)="submit($event)">
          @if (summary().length) {
            <sl-alert
              [title]="
                'Fix ' +
                summary().length +
                (summary().length === 1 ? ' thing' : ' things') +
                ' to save'
              "
              [items]="summary()"
              [focusOnShow]="true"
            />
          }
          <sl-form-field
            fieldId="new-password"
            label="New password"
            type="password"
            autocomplete="new-password"
            help="At least 10 characters."
            [error]="errors()['new-password']"
            [readonly]="busy()"
            [(value)]="password"
          />
          <sl-form-field
            fieldId="confirm-password"
            label="Confirm new password"
            type="password"
            autocomplete="new-password"
            [error]="errors()['confirm-password']"
            [readonly]="busy()"
            [(value)]="confirm"
          />
          <sl-button type="submit" [busy]="busy()">{{
            busy() ? 'Saving' : 'Save password'
          }}</sl-button>
        </form>
      </sl-auth-layout>
    }
  `,
  styles: `
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
  `,
})
export class ResetPasswordPage {
  private readonly api = inject(AUTH_API);
  private readonly session = inject(Session);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';

  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly expired = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    if (this.password().length < 10) {
      errors['new-password'] = 'Use at least 10 characters.';
      items.push({ message: 'Use at least 10 characters.', fieldId: 'new-password' });
    }
    if (this.password() !== this.confirm()) {
      errors['confirm-password'] = 'The passwords don’t match.';
      items.push({ message: 'The passwords don’t match.', fieldId: 'confirm-password' });
    }
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    this.api.resetPassword(this.token, this.password(), this.confirm()).subscribe({
      next: ({ token }) => {
        this.session.start(token, '');
        this.api.me().subscribe({
          next: (p) => this.session.start(token, p.displayName, p.role),
          error: () => undefined,
        });
        this.done.set(true);
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        this.expired.set(p.status === 410 || p.status === 400);
      },
    });
  }
}

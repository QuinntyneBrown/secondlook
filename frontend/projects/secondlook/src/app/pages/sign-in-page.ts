import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiProblem, AUTH_API } from 'api';
import { Alert, Button, FormField, SummaryItem } from 'components';
import { Session } from '../session';
import { AuthLayout } from '../ui/auth-layout';

@Component({
  selector: 'sl-sign-in-page',
  imports: [AuthLayout, FormField, Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-auth-layout title="Sign in" lead="Welcome back. Your inspections are waiting.">
      <form novalidate (submit)="submit($event)">
        @if (summary().length) {
          <sl-alert
            [title]="
              'Fix ' +
              summary().length +
              (summary().length === 1 ? ' thing' : ' things') +
              ' to sign in'
            "
            [items]="summary()"
            [focusOnShow]="true"
          />
        }
        @if (rejected()) {
          <sl-alert
            title="That email and password don’t match"
            text="Check them and try again, or reset your password."
          >
            <a routerLink="/forgot-password">Reset password</a>
          </sl-alert>
        }
        @if (unverified()) {
          <sl-alert
            title="Verify your email to sign in"
            text="Open the link we emailed you, or ask for a new one."
          />
        }
        @if (failed()) {
          <sl-alert
            title="We couldn’t sign you in"
            text="Something went wrong on our side. Try again in a moment."
          />
        }
        <sl-form-field
          fieldId="email"
          label="Email"
          type="email"
          autocomplete="email"
          [error]="errors()['email']"
          [readonly]="busy()"
          [(value)]="email"
        />
        <sl-form-field
          fieldId="password"
          label="Password"
          type="password"
          autocomplete="current-password"
          [error]="errors()['password']"
          [readonly]="busy()"
          [(value)]="password"
        />
        <a routerLink="/forgot-password">Forgot your password?</a>
        <sl-button type="submit" [busy]="busy()">{{ busy() ? 'Signing in' : 'Sign in' }}</sl-button>
      </form>
      <span slot="foot"><a routerLink="/sign-up">Create an account</a></span>
    </sl-auth-layout>
  `,
  styles: `
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
  `,
})
export class SignInPage {
  private readonly api = inject(AUTH_API);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly rejected = signal(false);
  protected readonly unverified = signal(false);
  protected readonly failed = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.rejected.set(false);
    this.unverified.set(false);
    this.failed.set(false);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(this.email().trim())) {
      errors['email'] = 'Enter a valid email address, like name@example.com.';
      items.push({ message: 'Enter a valid email address.', fieldId: 'email' });
    }
    if (!this.password()) {
      errors['password'] = 'Enter your password.';
      items.push({ message: 'Enter your password.', fieldId: 'password' });
    }
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    this.api.signIn(this.email().trim(), this.password()).subscribe({
      next: (r) => {
        this.session.start(r.token, r.displayName);
        void this.router.navigateByUrl('/inspections');
      },
      error: (p: ApiProblem) => {
        this.busy.set(false);
        if (p.status === 401) {
          this.password.set('');
          this.rejected.set(true);
        } else if (p.status === 403) this.unverified.set(true);
        else this.failed.set(true);
      },
    });
  }
}

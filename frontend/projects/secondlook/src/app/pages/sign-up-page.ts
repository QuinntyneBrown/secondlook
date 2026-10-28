import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiProblem, AUTH_API } from 'api';
import { Button } from 'components';
import { Alert, SummaryItem } from '../ui/alert';
import { AuthLayout } from '../ui/auth-layout';
import { FormField } from '../ui/form-field';

export const PENDING_EMAIL_KEY = 'secondlook.pendingEmail';

@Component({
  selector: 'sl-sign-up-page',
  imports: [AuthLayout, FormField, Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-auth-layout title="Create your account" lead="One account for every car you compare.">
      <form novalidate (submit)="submit($event)">
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
        @if (exists()) {
          <sl-alert
            title="There’s already an account for that email"
            text="Sign in instead, or reset your password if you’ve forgotten it."
          >
            <a routerLink="/sign-in">Sign in</a>
          </sl-alert>
        }
        @if (failed()) {
          <sl-alert
            title="We couldn’t create your account"
            text="Something went wrong on our side. Nothing was saved. Try again."
          />
        }
        <sl-form-field
          fieldId="name"
          label="Full name"
          autocomplete="name"
          [error]="errors()['name']"
          [readonly]="busy()"
          [(value)]="name"
        />
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
          fieldId="new-password"
          label="Password"
          type="password"
          autocomplete="new-password"
          help="At least 10 characters."
          [error]="errors()['new-password']"
          [readonly]="busy()"
          [(value)]="password"
        />
        <label class="choice">
          <input
            type="checkbox"
            name="terms"
            [checked]="agree()"
            (change)="agree.set($any($event.target).checked)"
          />
          <span
            >I agree to the <a routerLink="/terms">Terms</a> and
            <a routerLink="/privacy">Privacy policy</a>.</span
          >
        </label>
        <sl-button type="submit" [busy]="busy()">{{
          busy() ? 'Creating account' : 'Create account'
        }}</sl-button>
      </form>
      <span slot="foot">Already have one? <a routerLink="/sign-in">Sign in</a></span>
    </sl-auth-layout>
  `,
  styles: `
    form {
      display: grid;
      gap: var(--spacingVerticalL);
    }
    .choice {
      display: flex;
      gap: var(--spacingHorizontalS);
      align-items: start;
    }
  `,
})
export class SignUpPage {
  private readonly api = inject(AUTH_API);
  private readonly router = inject(Router);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly agree = signal(false);
  protected readonly busy = signal(false);
  protected readonly exists = signal(false);
  protected readonly failed = signal(false);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly summary = signal<SummaryItem[]>([]);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.exists.set(false);
    this.failed.set(false);

    const errors: Record<string, string> = {};
    const items: SummaryItem[] = [];
    if (!this.name().trim()) {
      errors['name'] = 'Enter your name.';
      items.push({ message: 'Enter your name.', fieldId: 'name' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(this.email().trim())) {
      errors['email'] = 'Enter a valid email address, like name@example.com.';
      items.push({ message: 'Enter a valid email address.', fieldId: 'email' });
    }
    if (this.password().length < 10) {
      errors['new-password'] = 'Use at least 10 characters.';
      items.push({ message: 'Use at least 10 characters.', fieldId: 'new-password' });
    }
    if (!items.length && !this.agree()) {
      items.push({
        message: 'Agree to the Terms and Privacy policy to continue.',
        fieldId: 'terms',
      });
    }
    this.errors.set(errors);
    this.summary.set([]);
    if (items.length) {
      // A fresh array re-creates the alert so focus moves to it on every failed submit.
      queueMicrotask(() => this.summary.set(items));
      return;
    }

    this.busy.set(true);
    const email = this.email().trim();
    this.api
      .register({
        fullName: this.name().trim(),
        email,
        password: this.password(),
        acceptedTerms: true,
      })
      .subscribe({
        next: () => {
          try {
            sessionStorage.setItem(PENDING_EMAIL_KEY, email);
          } catch {
            // the verify page falls back to asking for the address
          }
          void this.router.navigate(['/verify-email'], { queryParams: { email } });
        },
        error: (p: ApiProblem) => {
          this.busy.set(false);
          if (p.status === 409) this.exists.set(true);
          else this.failed.set(true);
        },
      });
  }
}

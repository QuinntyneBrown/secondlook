import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AUTH_API } from 'api';
import { Button } from 'components';
import { Alert } from '../ui/alert';
import { AuthLayout } from '../ui/auth-layout';
import { FormField } from '../ui/form-field';

@Component({
  selector: 'sl-forgot-password-page',
  imports: [AuthLayout, FormField, Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sent()) {
      <sl-auth-layout title="Reset your password">
        <sl-alert
          variant="success"
          title="Check your email"
          [text]="
            'If there’s an account for ' +
            email() +
            ', a reset link is on its way. It works for 30 minutes.'
          "
        />
        <sl-button routerLink="/sign-in">Back to sign in</sl-button>
      </sl-auth-layout>
    } @else {
      <sl-auth-layout
        title="Reset your password"
        lead="We’ll email you a link to choose a new one."
      >
        <form novalidate (submit)="submit($event)">
          @if (invalid()) {
            <sl-alert
              title="Enter your email address"
              [items]="[{ message: 'Enter a valid email address.', fieldId: 'email' }]"
              [focusOnShow]="true"
            />
          }
          @if (failed()) {
            <sl-alert
              title="We couldn’t send the email"
              text="Our mail service didn’t respond. Nothing was changed. Try again in a minute."
            />
          }
          <sl-form-field
            fieldId="email"
            label="Email"
            type="email"
            autocomplete="email"
            [error]="invalid() ? 'Enter a valid email address, like name@example.com.' : null"
            [readonly]="busy()"
            [(value)]="email"
          />
          <sl-button type="submit" [busy]="busy()">{{
            busy() ? 'Sending' : 'Send reset link'
          }}</sl-button>
        </form>
        <span slot="foot"><a routerLink="/sign-in">Back to sign in</a></span>
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
export class ForgotPasswordPage {
  private readonly api = inject(AUTH_API);

  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly invalid = signal(false);
  protected readonly failed = signal(false);
  protected readonly sent = signal(false);

  protected submit(event: Event) {
    event.preventDefault();
    if (this.busy()) return;
    this.failed.set(false);
    this.invalid.set(false);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@.]+$/.test(this.email().trim())) {
      queueMicrotask(() => this.invalid.set(true));
      return;
    }
    this.busy.set(true);
    this.api.forgotPassword(this.email().trim()).subscribe({
      next: () => this.sent.set(true),
      error: () => {
        this.busy.set(false);
        this.failed.set(true);
      },
    });
  }
}

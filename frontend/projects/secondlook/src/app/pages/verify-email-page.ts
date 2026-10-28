import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiProblem, AUTH_API } from 'api';
import { Button } from 'components';
import { Alert } from '../ui/alert';
import { AuthLayout } from '../ui/auth-layout';
import { PENDING_EMAIL_KEY } from './sign-up-page';

type View = 'check' | 'verifying' | 'verified' | 'expired' | 'invalid';

@Component({
  selector: 'sl-verify-email-page',
  imports: [AuthLayout, Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (view()) {
      @case ('check') {
        <sl-auth-layout title="Check your email">
          <p>We sent a link to {{ email() }}. Open it on this device to finish setting up.</p>
          @if (resent()) {
            <sl-alert
              variant="success"
              title="Email sent"
              text="Check your inbox for a new link."
            />
          }
          <sl-button variant="outline" (pressed)="resend()">Resend email</sl-button>
          <span slot="foot">Wrong address? <a routerLink="/sign-up">Use a different email</a></span>
        </sl-auth-layout>
      }
      @case ('verifying') {
        <sl-auth-layout title="Verifying">
          <p role="status">Verifying your email…</p>
        </sl-auth-layout>
      }
      @case ('verified') {
        <sl-auth-layout title="You’re verified">
          <sl-alert
            variant="success"
            title="Email verified"
            text="You’re all set. Book your first inspection whenever you’re ready."
          />
          <sl-button routerLink="/sign-in">Book an inspection</sl-button>
        </sl-auth-layout>
      }
      @default {
        <sl-auth-layout title="We couldn’t verify that link">
          <sl-alert
            [title]="view() === 'expired' ? 'That link has expired' : 'That link isn’t valid'"
            text="Verification links work for 24 hours. We can send a new one."
          />
          <sl-button (pressed)="resend()">Send a new link</sl-button>
        </sl-auth-layout>
      }
    }
  `,
})
export class VerifyEmailPage {
  private readonly api = inject(AUTH_API);
  private readonly route = inject(ActivatedRoute);

  protected readonly view = signal<View>('check');
  protected readonly resent = signal(false);
  protected readonly email = signal('');

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    const token = query.get('token');
    this.email.set(query.get('email') ?? this.remembered());
    if (token) {
      this.view.set('verifying');
      this.api.verifyEmail(token).subscribe({
        next: () => this.view.set('verified'),
        error: (p: ApiProblem) => this.view.set(p.status === 410 ? 'expired' : 'invalid'),
      });
    }
  }

  protected resend() {
    const email = this.email();
    if (!email) return;
    this.api.resendVerification(email).subscribe({ next: () => this.resent.set(true) });
  }

  private remembered(): string {
    try {
      return sessionStorage.getItem(PENDING_EMAIL_KEY) ?? '';
    } catch {
      return '';
    }
  }
}

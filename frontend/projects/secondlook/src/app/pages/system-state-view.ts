import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Button, EmptyState } from 'components';

interface Action {
  label: string;
  link?: string;
  href?: string;
  retry?: boolean;
  variant: 'primary' | 'outline';
}
interface State {
  code: string;
  title: string;
  text: string;
  actions: Action[];
}

export type SystemStateKey = 'not-found' | 'forbidden' | 'server-error' | 'offline' | 'maintenance';

const SUPPORT = 'mailto:support@secondlook.example';

export const SYSTEM_STATES: Record<SystemStateKey, State> = {
  'not-found': {
    code: '404',
    title: 'We can’t find that page',
    text: 'The link may be old, or the inspection was removed. Head back to your inspections.',
    actions: [
      { label: 'Go to inspections', link: '/inspections', variant: 'primary' },
      { label: 'Home', link: '/', variant: 'outline' },
    ],
  },
  forbidden: {
    code: '403',
    title: 'This inspection isn’t on your account',
    text: 'Only the buyer who booked it can see the report. If someone shared this link with you, ask them to share the report from their account.',
    actions: [
      { label: 'Go to inspections', link: '/inspections', variant: 'primary' },
      { label: 'Contact support', href: SUPPORT, variant: 'outline' },
    ],
  },
  'server-error': {
    code: '500',
    title: 'That one’s on us',
    text: 'Something broke on our side. Your booking and payment are safe. Try again, and if it keeps happening, tell us.',
    actions: [
      { label: 'Try again', retry: true, variant: 'primary' },
      { label: 'Contact support', href: SUPPORT, variant: 'outline' },
    ],
  },
  offline: {
    code: 'Offline',
    title: 'You’re not connected',
    text: 'You can still read reports you’ve already opened. Booking and live calls need a connection.',
    actions: [
      { label: 'Try again', retry: true, variant: 'primary' },
      { label: 'View saved reports', link: '/reports', variant: 'outline' },
    ],
  },
  maintenance: {
    code: 'Maintenance',
    title: 'Back in about 20 minutes',
    text: 'We’re updating SecondLook. Inspections booked for tonight will go ahead; we’ll email if anything changes.',
    actions: [{ label: 'Check status', retry: true, variant: 'primary' }],
  },
};

/** One system state (404, 403, 500, offline, maintenance) with its actions. */
@Component({
  selector: 'sl-system-state-view',
  imports: [EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-empty-state [code]="state().code" [title]="state().title" [text]="state().text">
      <div slot="actions" style="display: contents">
        @for (a of state().actions; track a.label) {
          @if (a.retry) {
            <sl-button [variant]="a.variant" (pressed)="retry.emit()">{{ a.label }}</sl-button>
          } @else if (a.link) {
            <sl-button [variant]="a.variant" [routerLink]="a.link">{{ a.label }}</sl-button>
          } @else {
            <sl-button [variant]="a.variant" [href]="a.href ?? null">{{ a.label }}</sl-button>
          }
        }
      </div>
    </sl-empty-state>
  `,
})
export class SystemStateView {
  readonly key = input.required<SystemStateKey>();
  readonly retry = output<void>();
  protected readonly state = computed(() => SYSTEM_STATES[this.key()]);
}

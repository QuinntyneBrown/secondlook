import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Button, EmptyState } from 'components';

interface Action {
  label: string;
  link?: string;
  href?: string;
  variant: 'primary' | 'outline';
}
interface State {
  code: string;
  title: string;
  text: string;
  actions: Action[];
}

const SUPPORT = 'mailto:support@secondlook.example';

export const SYSTEM_STATES: Record<string, State> = {
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
  offline: {
    code: 'Offline',
    title: 'You’re not connected',
    text: 'You can still read reports you’ve already opened. Booking and live calls need a connection.',
    actions: [
      { label: 'Try again', link: '/', variant: 'primary' },
      { label: 'View saved reports', link: '/reports', variant: 'outline' },
    ],
  },
  maintenance: {
    code: 'Maintenance',
    title: 'Back in about 20 minutes',
    text: 'We’re updating SecondLook. Inspections booked for tonight will go ahead; we’ll email if anything changes.',
    actions: [{ label: 'Check status', link: '/', variant: 'primary' }],
  },
};

/** Renders the system state named by the route's `state` data. */
@Component({
  selector: 'sl-system-page',
  imports: [EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <sl-empty-state [code]="state().code" [title]="state().title" [text]="state().text">
      <div slot="actions" style="display: contents">
        @for (a of state().actions; track a.label) {
          @if (a.label === 'Try again' || a.label === 'Check status') {
            <sl-button [variant]="a.variant" (pressed)="reload()">{{ a.label }}</sl-button>
          } @else if (a.link) {
            <sl-button [variant]="a.variant" [routerLink]="a.link">{{ a.label }}</sl-button>
          } @else {
            <sl-button [variant]="a.variant" [href]="a.href!">{{ a.label }}</sl-button>
          }
        }
      </div>
    </sl-empty-state>
  `,
})
export class SystemPage {
  private readonly route = inject(ActivatedRoute);
  readonly state = computed(() => SYSTEM_STATES[this.route.snapshot.data['state']]);

  reload() {
    location.assign('/');
  }
}

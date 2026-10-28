import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PLATFORM_API } from 'api';
import { Button, EmptyState } from 'components';

/** The landing screen: proves the shell can reach the API and shows the 500 state when it cannot. */
@Component({
  selector: 'sl-readiness-page',
  imports: [EmptyState, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (state() === 'failed') {
      <sl-empty-state
        code="500"
        title="That one’s on us"
        text="Something broke on our side. Your booking and payment are safe. Try again, and if it keeps happening, tell us."
      >
        <div slot="actions" style="display: contents">
          <sl-button (pressed)="check()">Try again</sl-button>
          <sl-button variant="outline" href="mailto:support@secondlook.example"
            >Contact support</sl-button
          >
        </div>
      </sl-empty-state>
    } @else {
      <p role="status" class="status">
        {{ state() === 'ready' ? 'The API is ready.' : 'Checking the APIï¿½' }}
      </p>
    }
  `,
  styles: `
    .status {
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      color: var(--colorNeutralForeground1);
      font-family: var(--fontFamilyBase);
      text-align: center;
    }
  `,
})
export class ReadinessPage {
  private readonly api = inject(PLATFORM_API);
  readonly state = signal<'checking' | 'ready' | 'failed'>('checking');

  constructor() {
    this.check();
  }

  check() {
    this.state.set('checking');
    this.api.ready().subscribe({
      next: () => this.state.set('ready'),
      error: () => this.state.set('failed'),
    });
  }
}

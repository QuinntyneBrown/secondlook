import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Button, EmptyState } from 'components';

@Component({
  selector: 'sl-perf-empty-state',
  imports: [EmptyState, Button],
  template: `
    <sl-empty-state code="404" title="We can’t find that page" text="The link may be old.">
      <div slot="actions" style="display: contents">
        <sl-button>Go to inspections</sl-button>
        <sl-button variant="outline">Home</sl-button>
      </div>
    </sl-empty-state>
  `,
})
export default class EmptyStateScenario {}

export const providers = [provideRouter([])];

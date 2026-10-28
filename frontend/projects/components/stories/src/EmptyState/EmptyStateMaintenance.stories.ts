import { moduleMetadata, type StoryObj } from '@storybook/angular';
import { Button, EmptyState } from 'components';

export const Maintenance: StoryObj<EmptyState> = {
  decorators: [moduleMetadata({ imports: [Button] })],
  render: () => ({
    template: `
      <sl-empty-state code="Maintenance" title="Back in about 20 minutes" text="We’re updating SecondLook. Inspections booked for tonight will go ahead; we’ll email if anything changes.">
        <div slot="actions" style="display: contents"><sl-button>Check status</sl-button></div>
      </sl-empty-state>`,
  }),
};

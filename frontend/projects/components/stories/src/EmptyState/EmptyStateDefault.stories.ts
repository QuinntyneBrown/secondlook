import { moduleMetadata, type StoryObj } from '@storybook/angular';
import { Button, EmptyState } from 'components';

export const Default: StoryObj<EmptyState> = {
  decorators: [moduleMetadata({ imports: [Button] })],
  render: () => ({
    template: `
      <sl-empty-state code="404" title="We can’t find that page" text="The link may be old, or the inspection was removed. Head back to your inspections.">
        <div slot="actions" style="display: contents">
          <sl-button routerLink="/inspections">Go to inspections</sl-button>
          <sl-button variant="outline" routerLink="/">Home</sl-button>
        </div>
      </sl-empty-state>`,
  }),
};

import type { StoryObj } from '@storybook/angular';
import { Alert } from 'components';

export const Success: StoryObj<Alert> = {
  render: () => ({
    template: `<sl-alert variant="success" title="Password updated" text="You’re signed in. Your inspections are one tap away."></sl-alert>`,
  }),
};

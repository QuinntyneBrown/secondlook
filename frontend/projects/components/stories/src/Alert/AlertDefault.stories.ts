import type { StoryObj } from '@storybook/angular';
import { Alert } from 'components';

export const Default: StoryObj<Alert> = {
  render: () => ({
    template: `<sl-alert title="That email and password don’t match" text="Check them and try again, or reset your password."></sl-alert>`,
  }),
};

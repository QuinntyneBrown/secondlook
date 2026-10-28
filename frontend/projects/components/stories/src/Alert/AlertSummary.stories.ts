import type { StoryObj } from '@storybook/angular';
import { Alert } from 'components';

export const Summary: StoryObj<Alert> = {
  render: () => ({
    template: `<sl-alert title="Fix 2 things to sign in" [items]="[{ message: 'Enter a valid email address.', fieldId: 'email' }, { message: 'Enter your password.', fieldId: 'password' }]"></sl-alert>`,
  }),
};

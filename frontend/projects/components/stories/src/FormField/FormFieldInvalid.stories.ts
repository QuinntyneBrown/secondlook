import type { StoryObj } from '@storybook/angular';
import { FormField } from 'components';

export const Invalid: StoryObj<FormField> = {
  render: () => ({
    template: `<sl-form-field fieldId="email" label="Email" type="email" error="Enter a valid email address, like name@example.com."></sl-form-field>`,
  }),
};

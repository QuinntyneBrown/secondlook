import type { StoryObj } from '@storybook/angular';
import { FormField } from 'components';

export const Default: StoryObj<FormField> = {
  render: () => ({
    template: `<sl-form-field fieldId="name" label="Full name"></sl-form-field>`,
  }),
};

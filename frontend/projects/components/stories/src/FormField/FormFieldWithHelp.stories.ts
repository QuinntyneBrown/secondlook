import type { StoryObj } from '@storybook/angular';
import { FormField } from 'components';

export const WithHelp: StoryObj<FormField> = {
  render: () => ({
    template: `<sl-form-field fieldId="pw" label="Password" type="password" help="At least 10 characters."></sl-form-field>`,
  }),
};

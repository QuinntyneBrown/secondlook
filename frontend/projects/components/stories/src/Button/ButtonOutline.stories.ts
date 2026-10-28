import type { StoryObj } from '@storybook/angular';
import { Button } from 'components';

export const Outline: StoryObj<Button> = {
  render: (args) => ({ props: args, template: `<sl-button variant="outline">Home</sl-button>` }),
};

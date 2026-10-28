import type { StoryObj } from '@storybook/angular';
import { Button } from 'components';

export const Default: StoryObj<Button> = {
  render: (args) => ({ props: args, template: `<sl-button>Go to inspections</sl-button>` }),
};

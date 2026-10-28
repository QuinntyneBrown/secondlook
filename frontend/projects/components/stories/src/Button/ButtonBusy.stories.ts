import type { StoryObj } from '@storybook/angular';
import { Button } from 'components';

export const Busy: StoryObj<Button> = {
  render: (args) => ({ props: args, template: `<sl-button [busy]="true">Try again</sl-button>` }),
};

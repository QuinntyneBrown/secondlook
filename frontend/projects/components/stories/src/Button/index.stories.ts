import type { Meta } from '@storybook/angular';
import { Button } from 'components';
import description from './ButtonDescription.md';
import bestPractices from './ButtonBestPractices.md';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: { docs: { description: { component: [description, bestPractices].join('\n') } } },
};

export default meta;

export { Default } from './ButtonDefault.stories';
export { Outline } from './ButtonOutline.stories';
export { Busy } from './ButtonBusy.stories';

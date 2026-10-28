import type { Meta } from '@storybook/angular';
import { Alert } from 'components';
import description from './AlertDescription.md';
import bestPractices from './AlertBestPractices.md';

const meta: Meta<Alert> = {
  title: 'Components/Alert',
  component: Alert,
  parameters: { docs: { description: { component: [description, bestPractices].join('\n') } } },
};

export default meta;

export { Default } from './AlertDefault.stories';
export { Summary } from './AlertSummary.stories';
export { Success } from './AlertSuccess.stories';

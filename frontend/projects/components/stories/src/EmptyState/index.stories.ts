import type { Meta } from '@storybook/angular';
import { EmptyState } from 'components';
import description from './EmptyStateDescription.md';
import bestPractices from './EmptyStateBestPractices.md';

const meta: Meta<EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: { docs: { description: { component: [description, bestPractices].join('\n') } } },
};

export default meta;

export { Default } from './EmptyStateDefault.stories';
export { Maintenance } from './EmptyStateMaintenance.stories';

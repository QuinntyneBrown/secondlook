import type { Meta } from '@storybook/angular';
import { FormField } from 'components';
import description from './FormFieldDescription.md';
import bestPractices from './FormFieldBestPractices.md';

const meta: Meta<FormField> = {
  title: 'Components/FormField',
  component: FormField,
  parameters: { docs: { description: { component: [description, bestPractices].join('\n') } } },
};

export default meta;

export { Default } from './FormFieldDefault.stories';
export { WithHelp } from './FormFieldWithHelp.stories';
export { Invalid } from './FormFieldInvalid.stories';

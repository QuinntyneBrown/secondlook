import { addons } from 'storybook/manager-api';

import secondlookTheme from './theme';

addons.setConfig({
  theme: secondlookTheme,
  // Docs-first like the Fluent docsite: the addon panel opens on demand.
  showPanel: false,
  sidebar: {
    showRoots: true,
  },
});

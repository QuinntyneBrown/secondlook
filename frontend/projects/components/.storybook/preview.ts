import { provideRouter, withHashLocation } from '@angular/router';
import { setCompodocJson } from '@storybook/addon-docs/angular';
import { applicationConfig, type Preview } from '@storybook/angular';

import docJson from '../documentation.json';
import { secondlookLightTheme as theme } from '../src/lib/tokens';

// Inputs, outputs and JSDoc for the autodocs ArgTypes tables come from
// compodoc (`compodoc: true` on the angular.json storybook targets).
setCompodocJson(docJson);

/**
 * Every story renders inside the same global chrome as the app: the
 * `storybook.scss` entry (`angular.json` → `styles`) forwards the tokens,
 * breakpoints, reset and the CDK overlay stylesheet, exactly like
 * `projects/secondlook/src/styles.scss`. A router is provided because
 * `sl-button` / `sl-list-item` route in-app `href`s through it; hash
 * location plus a catch-all route keep those clicks inside the preview
 * iframe instead of rewriting `iframe.html`.
 */
const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [provideRouter([{ path: '**', children: [] }], withHashLocation())],
    }),
  ],
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    backgrounds: {
      options: {
        cream: { name: 'Cream (--colorNeutralBackground2)', value: theme.colorNeutralBackground2 },
        surface: {
          name: 'Surface (--colorNeutralBackground1)',
          value: theme.colorNeutralBackground1,
        },
        recessed: {
          name: 'Recessed (--colorNeutralBackground3)',
          value: theme.colorNeutralBackground3,
        },
      },
    },
    viewport: {
      // The three Playwright projects (e2e/playwright.config.ts) plus the
      // 320px floor the xsmall tier retunes for.
      options: {
        xsmall: {
          name: 'xsmall (320×640)',
          styles: { width: '320px', height: '640px' },
          type: 'mobile',
        },
        mobile: {
          name: 'Mobile (390×844)',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
        tablet: {
          name: 'Tablet (820×1180)',
          styles: { width: '820px', height: '1180px' },
          type: 'tablet',
        },
        desktop: {
          name: 'Desktop (1440×900)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i },
    },
    a11y: {
      // Fail the a11y panel loudly; the mocks are AA by design.
      test: 'error',
    },
    docs: {
      toc: { headingSelector: 'h2, h3' },
    },
    options: {
      storySort: {
        method: 'alphabetical',
        /**
         * @see https://storybook.js.org/docs/writing-stories/naming-components-and-hierarchy#sorting-stories
         */
        order: [
          'Concepts',
          [
            'Introduction',
            'Developer',
            ['Quick Start', 'Styling Components', 'Accessibility', 'Writing Stories'],
          ],
          'Theme',
          ['Colors', 'Typography', 'Spacing', 'Border Radii', 'Shadows', 'Motion', 'Layout'],
          'Components',
          'Patterns',
        ],
      },
    },
  },
};

export default preview;

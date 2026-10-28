import type { StorybookConfig } from '@storybook/angular';

/**
 * SecondLook design system — the Storybook docsite for the `components`
 * library. Layout follows the Fluent UI v9 docsite: MDX concept and theme
 * pages under `stories/src/{Concepts,Theme}`, one folder per component with an
 * `index.stories.ts` that owns the meta and re-exports the individual
 * `<Component><Story>.stories.ts` files, plus `<Component>Description.md` /
 * `<Component>BestPractices.md` prose for the autodocs page.
 *
 * Only `index.stories.ts` files are globbed; the per-story files are plain
 * modules so each example stays small and copy-pasteable.
 */
const config: StorybookConfig = {
  stories: ['../stories/src/**/*.mdx', '../stories/src/**/index.stories.ts'],
  staticDirs: ['./public'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  docs: {
    defaultName: 'Docs',
  },
  webpackFinal: async (webpackConfig) => {
    // `<Component>Description.md` and `<Component>BestPractices.md` load as
    // plain strings for `parameters.docs.description.component`.
    webpackConfig.module ??= {};
    webpackConfig.module.rules ??= [];
    webpackConfig.module.rules.push({ test: /\.md$/, type: 'asset/source' });
    return webpackConfig;
  },
};

export default config;

import { create } from 'storybook/theming';

import { secondlookLightTheme as t } from '../src/lib/tokens';

/**
 * Brands the Storybook manager with the SecondLook palette. The manager runs
 * outside the preview iframe, so it cannot read the custom properties; it
 * reads the same TypeScript theme `_tokens.scss` is generated from instead.
 * See https://storybook.js.org/docs/configure/user-interface/theming
 */
const theme = create({
  base: 'light',

  colorPrimary: t.colorBrandBackground,
  colorSecondary: t.colorBrandBackground,

  // UI
  appBg: t.colorNeutralBackground2,
  appContentBg: t.colorNeutralBackground1,
  appPreviewBg: t.colorNeutralBackground2,
  appBorderColor: t.colorNeutralStroke2,
  appBorderRadius: parseInt(t.borderRadiusMedium, 10),

  // Fonts
  fontBase: t.fontFamilyBase,
  fontCode: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',

  // Text colors
  textColor: t.colorNeutralForeground1,
  textMutedColor: t.colorNeutralForeground2,
  textInverseColor: t.colorNeutralForegroundOnBrand,

  // Toolbar default and active colors
  barTextColor: t.colorNeutralForeground2,
  barSelectedColor: t.colorBrandForeground1,
  barHoverColor: t.colorBrandForeground2,
  barBg: t.colorNeutralBackground1,

  // Form colors
  inputBg: t.colorNeutralBackground1,
  inputBorder: t.colorNeutralStroke1,
  inputTextColor: t.colorNeutralForeground1,
  inputBorderRadius: parseInt(t.borderRadiusSmall, 10),

  brandTitle: 'SecondLook Design System',
  brandUrl: 'https://github.com/QuinntyneBrown/secondlook',
  brandImage: './secondlook-wordmark.svg',
  brandTarget: '_self',
});

export default theme;

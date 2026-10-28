import type { Theme, ThemeOverride } from '../types';

/** Light theme; the brand ramp comes from docs/design-system/tokens. */
export const secondlookLightTheme: Theme = {
  colorNeutralBackground1: '#ffffff',
  colorNeutralBackground2: '#f6f4ef',
  colorNeutralBackground3: '#ece9e1',
  colorNeutralForeground1: '#14181f',
  colorNeutralForeground2: '#4a5260',
  colorNeutralForeground3: '#5b6472',
  colorNeutralForegroundOnBrand: '#ffffff',
  colorNeutralStroke1: '#5b6472',
  colorNeutralStroke2: '#dcd8ce',
  colorBrandBackground: '#c9480b',
  colorBrandBackgroundHover: '#a93c09',
  colorBrandBackgroundPressed: '#8a3107',
  colorBrandForeground1: '#a93c09',
  colorBrandForeground2: '#8a3107',
  colorBrandStroke1: '#c9480b',
  colorStatusDangerBackground1: '#fbe4e1',
  colorStatusDangerForeground1: '#a12b22',
  colorStatusSuccessBackground1: '#e3f3e6',
  colorStatusSuccessForeground1: '#1d6b34',
  colorStatusWarningBackground1: '#fdf1d6',
  colorStatusWarningForeground1: '#8a5a00',
  fontFamilyBase:
    '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizeBase300: '14px',
  fontSizeBase500: '20px',
  fontSizeHero800: '40px',
  fontWeightRegular: '400',
  fontWeightSemibold: '600',
  lineHeightBase300: '20px',
  spacingHorizontalS: '8px',
  spacingHorizontalM: '12px',
  spacingHorizontalL: '16px',
  spacingHorizontalXXL: '24px',
  spacingVerticalS: '8px',
  spacingVerticalM: '12px',
  spacingVerticalL: '16px',
  spacingVerticalXXL: '24px',
  borderRadiusSmall: '2px',
  borderRadiusMedium: '4px',
  borderRadiusLarge: '8px',
  strokeWidthThin: '1px',
  durationNormal: '200ms',
};

/** Retunes for wider viewports. */
export const responsiveOverrides: ThemeOverride[] = [
  {
    media: '(min-width: 768px)',
    selector: ':root',
    theme: { spacingHorizontalL: '20px', fontSizeHero800: '48px' },
  },
];

export const darkSchemeOverride: ThemeOverride = {
  media: '(prefers-color-scheme: dark)',
  selector: ':root',
  theme: {
    colorNeutralBackground1: '#14181f',
    colorNeutralBackground2: '#0d1015',
    colorNeutralBackground3: '#1f242d',
    colorNeutralForeground1: '#e9ecf1',
    colorNeutralForeground2: '#b3bac5',
    colorNeutralForeground3: '#959eab',
    colorNeutralStroke1: '#959eab',
    colorNeutralStroke2: '#2a303a',
    colorBrandBackground: '#c9480b',
    colorBrandForeground1: '#f4b48f',
    colorBrandForeground2: '#f8d3bc',
    colorBrandStroke1: '#f4b48f',
    colorStatusDangerBackground1: '#3a1512',
    colorStatusDangerForeground1: '#f7cac5',
    colorStatusSuccessBackground1: '#12301c',
    colorStatusSuccessForeground1: '#9bd8ac',
    colorStatusWarningBackground1: '#3a2a08',
    colorStatusWarningForeground1: '#f1cf86',
  },
};

export const reducedMotionOverride: ThemeOverride = {
  media: '(prefers-reduced-motion: reduce)',
  selector: ':root',
  theme: { durationNormal: '0ms' },
};

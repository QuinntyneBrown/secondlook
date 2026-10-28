/** A theme: Fluent UI v9 style role tokens, each a CSS value. */
export interface Theme {
  colorNeutralBackground1: string;
  colorNeutralBackground2: string;
  colorNeutralBackground3: string;
  colorNeutralForeground1: string;
  colorNeutralForeground2: string;
  colorNeutralForeground3: string;
  colorNeutralForegroundOnBrand: string;
  colorNeutralStroke1: string;
  colorNeutralStroke2: string;
  colorBrandBackground: string;
  colorBrandBackgroundHover: string;
  colorBrandBackgroundPressed: string;
  colorBrandForeground1: string;
  colorBrandStroke1: string;
  colorStatusDangerBackground1: string;
  colorStatusDangerForeground1: string;
  colorStatusSuccessBackground1: string;
  colorStatusSuccessForeground1: string;
  colorStatusWarningBackground1: string;
  colorStatusWarningForeground1: string;
  fontFamilyBase: string;
  fontSizeBase300: string;
  fontSizeBase500: string;
  fontSizeHero800: string;
  fontWeightRegular: string;
  fontWeightSemibold: string;
  lineHeightBase300: string;
  spacingHorizontalS: string;
  spacingHorizontalM: string;
  spacingHorizontalL: string;
  spacingHorizontalXXL: string;
  spacingVerticalS: string;
  spacingVerticalM: string;
  spacingVerticalL: string;
  spacingVerticalXXL: string;
  borderRadiusMedium: string;
  borderRadiusLarge: string;
  strokeWidthThin: string;
  durationNormal: string;
}

/** Tokens a media query or selector retunes. */
export interface ThemeOverride {
  /** Media query condition, e.g. `(prefers-color-scheme: dark)`. */
  media: string;
  /** Selector the variables apply to inside the query. */
  selector: string;
  theme: Partial<Theme>;
}

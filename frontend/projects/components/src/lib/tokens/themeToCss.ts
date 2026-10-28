import type { Theme, ThemeOverride } from './types';

const declarations = (theme: Partial<Theme>) =>
  Object.entries(theme)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n');

/** Renders a base theme as `:root` custom properties followed by one `@media` block per override. */
export function themeToCss(base: Theme, overrides: ThemeOverride[]): string {
  const blocks = [`:root {\n${declarations(base)}\n}`];
  for (const o of overrides) {
    blocks.push(`@media ${o.media} {\n${o.selector} {\n${declarations(o.theme)}\n}\n}`);
  }
  return blocks.join('\n\n');
}

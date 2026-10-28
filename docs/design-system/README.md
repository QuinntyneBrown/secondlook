# SecondLook design system

Extracted from [docs/mocks](../mocks/README.md) on 2026-10-28. Open [index.html](index.html) locally in a browser.

## Foundations

| Page | Covers |
| --- | --- |
| [Color](foundations/color.html) | Ramps, roles, themes, contrast |
| [Typography](foundations/typography.html) | Plex Sans and Mono, scale, roles |
| [Spacing](foundations/spacing.html) | 4px scale and rules |
| [Layout and grid](foundations/layout.html) | Breakpoints, grid, templates |
| [Elevation](foundations/elevation.html) | Shadows and z-order |
| [Shape](foundations/shape.html) | Radii and borders |
| [Motion](foundations/motion.html) | Durations, easings, reduced motion |
| [Iconography](foundations/iconography.html) | 24-unit stroke icons |
| [Theming](foundations/theming.html) | Light, dark, high contrast |
| [Responsive](foundations/responsive.html) | Mobile-first rules |
| [Accessibility](foundations/accessibility.html) | WCAG 2.2 AA commitments |
| [Content](foundations/content.html) | Voice, casing, microcopy |

## Components

| Component | Group | Variants | States | Source mocks |
| --- | --- | --- | --- | --- |
| [Button](components/button.html) | Actions | Primary, secondary, ghost, link, danger; With icons, icon-only and block | Default, Hover, Focus, Active, Disabled, Loading | 162 files |
| [Button group](components/button-group.html) | Actions | Segmented (single select); Toolbar | Default, Hover, Pressed, Disabled | core set (no mock yet) |
| [Link](components/link.html) | Actions | Inline and stand-alone; External | Default, Hover, Focus | 3 files |
| [Menu](components/menu.html) | Actions | Open menu | Default, Hover, Focus, Disabled | core set (no mock yet) |
| [Text field](components/text-field.html) | Inputs | Text, email, password, number; VIN (monospace) with help; Search and input group | Default, Hover, Focus, Invalid, Disabled, Read-only | 52 files |
| [Textarea](components/textarea.html) | Inputs | Default with counter | Default, Hover, Focus, Invalid, Disabled, Read-only | 4 files |
| [Select](components/select.html) | Inputs | Default with placeholder option | Default, Hover, Focus, Invalid, Disabled | 10 files |
| [Checkbox](components/checkbox.html) | Inputs | Single and group; Indeterminate | Unchecked, Hover, Focus, Checked, Invalid, Disabled | 25 files |
| [Radio group](components/radio-group.html) | Inputs | Vertical; Segmented (review type) | Unselected, Hover, Focus, Selected, Disabled | 32 files |
| [Switch](components/switch.html) | Inputs | Switch with description | Off, Hover, Focus, On, Disabled | 9 files |
| [Form field](components/form-field.html) | Inputs | Default; Invalid | Default, Invalid, Disabled | 61 files |
| [Form layout](components/form-layout.html) | Inputs | Form with error summary | Default, Submitting | 38 files |
| [Top bar](components/topbar.html) | Navigation | Signed in; Signed out | Default, Hover, Focus, Current | 142 files |
| [Sidebar navigation](components/sidebar.html) | Navigation | Grouped | Default, Hover, Focus, Current | core set (no mock yet) |
| [Tabs](components/tabs.html) | Navigation | Underline tabs | Default, Hover, Focus, Selected | 25 files |
| [Breadcrumb](components/breadcrumb.html) | Navigation | Full | Default, Hover, Focus | 67 files |
| [Pagination](components/pagination.html) | Navigation | Numbered | Default, Hover, Focus, Current, Disabled | 1 files |
| [Stepper](components/stepper.html) | Navigation | Horizontal | Upcoming, Current, Complete | 25 files |
| [Footer](components/footer.html) | Navigation | Simple | Default, Hover, Focus | 12 files |
| [Skip link](components/skip-link.html) | Navigation | Focused | Focused | 164 files |
| [Card](components/card.html) | Containers | Default, interactive, selected | Default, Hover, Focus | 139 files |
| [Accordion](components/accordion.html) | Containers | Help FAQ | Collapsed, Hover, Focus, Expanded | 3 files |
| [Dialog](components/dialog.html) | Containers | Confirmation | Default, Busy | 38 files |
| [Drawer](components/drawer.html) | Containers | Right drawer | Default, Busy | core set (no mock yet) |
| [Popover](components/popover.html) | Containers | Open | Closed, Open | core set (no mock yet) |
| [Tooltip](components/tooltip.html) | Containers | Visible | Hidden, Visible | core set (no mock yet) |
| [Divider](components/divider.html) | Containers | Horizontal | Default | core set (no mock yet) |
| [Container, stack and grid](components/layout.html) | Containers | Primitives | Default | 156 files |
| [Table](components/table.html) | Data display | Receipts; Sortable header | Default, Hover, Selected | 1 files |
| [List](components/list.html) | Data display | Inspections | Default, Hover, Focus | 41 files |
| [Description list](components/description-list.html) | Data display | Price lines (.kv); Details (.dl) | Default | 13 files |
| [Avatar](components/avatar.html) | Data display | Initials, group | Default | 118 files |
| [Badge](components/badge.html) | Data display | Tones; Solid and count | Default | 25 files |
| [Status pill](components/status.html) | Data display | States | Default | 70 files |
| [Chip](components/chip.html) | Data display | Filter and removable | Default, Hover, Focus, Selected | 9 files |
| [Stat](components/stat.html) | Data display | With delta | Default | core set (no mock yet) |
| [Timeline](components/timeline.html) | Data display | Inspection progress | Upcoming, Current, Done | 2 files |
| [Toast](components/toast.html) | Feedback | Success with action; Danger | Visible, Leaving | 17 files |
| [Alert and banner](components/alert.html) | Feedback | Tones; Banner | Default | 63 files |
| [Inline message](components/inline-message.html) | Feedback | Messages | Default | 15 files |
| [Progress bar](components/progress.html) | Feedback | Bars | Default | 1 files |
| [Spinner](components/spinner.html) | Feedback | Sizes | Default | 3 files |
| [Skeleton](components/skeleton.html) | Feedback | Composed | Default | 11 files |
| [Empty state](components/empty-state.html) | Feedback | First run; Error | Default | 21 files |
| [Error page](components/error-page.html) | Feedback | 404 | Default | 21 files |
| [Price panel](components/price-panel.html) | Domain | Price calc | Default | 4 files |
| [Slot picker](components/slot-picker.html) | Domain | Grid | Default, Focus, Disabled | 7 files |
| [Estimate finding](components/finding.html) | Domain | Finding list | Default | 19 files |
| [Video tile](components/video-tile.html) | Domain | Tiles | Default | 13 files |
| [Logo and wordmark](components/logo.html) | Domain | Logo | Default, Hover, Focus | 164 files |

## Patterns

| Pattern | Covers |
| --- | --- |
| [Forms](patterns/forms.html) | Layout, validation timing, summaries and submit states for every form. |
| [Feedback and loading](patterns/feedback-and-loading.html) | Which feedback for which action, and which loading indicator for which wait. |
| [Empty and error states](patterns/empty-and-error-states.html) | Copy formulas and layouts for nothing-to-show and something-went-wrong. |
| [Navigation and page structure](patterns/navigation-and-page-structure.html) | The shell, page header, breadcrumbs, tabs versus pages and back behaviour. |
| [Dialogs and overlays](patterns/dialogs-and-overlays.html) | When to use a dialog, drawer, popover, menu or a page. |
| [Data tables and lists](patterns/data-tables-and-lists.html) | Density, sorting, selection and responsive strategy for records. |
| [Notifications](patterns/notifications.html) | Toast, banner and the notification list: priority, grouping and dismissal. |
| [Content and tone](patterns/content-and-tone.html) | Voice, buttons, numbers, errors and the microcopy library applied across screens. |

## Tokens

- `tokens/tokens.css` — source of truth for primitives, semantic tokens and themes.
- `tokens/tokens.json` — DTCG export generated by `tokens_to_json.py`.
- `tokens/contrast-pairs.json` — every foreground/background pairing the components rely on; checked in both themes.
- `assets/components.css` — the component stylesheet (token-driven, with `data-state` documentation hooks).

The Angular workspace keeps its own TypeScript theme (`frontend/projects/components/src/lib/tokens/`) as the product source; this system is the reference it mirrors.

## Drift found in the mocks

| Mock / file | Issue | Resolution |
| --- | --- | --- |
| `assets/tokens.css` | The `--palette-blue-*` ramp holds the orange Signal accent, so the name lies. | Kept for compatibility with every mock and with this kit; documented on the Color page. Rename in a later pass across mocks and the Angular theme together. |
| `assets/tokens.css` | `--palette-red-500` and `--palette-red-600` have the same value (#c2362b). | Left as aliases; components read `--color-danger-*` so no page depends on either step. |
| `notifications/booking-toast/*` (dark theme) | Toast icons used `--color-*-icon` on `--color-bg-inverse`, which flips light in dark mode: success 1.45:1, danger 1.73:1. | Added `--color-{info,success,warning,danger}-icon-inverse` tokens (darker steps in dark theme) and pointed `.toast--*` icons at them. Contrast now passes in both themes. |
| `assets/ui.css` | Only some components had `data-state` hooks, so focus, selected and invalid could not be shown statically. | Added a documentation state-hook block to `assets/components.css`; behaviour is unchanged. |
| `assets/ui.css` (`.price-calc`, `.video-tile`) | Read `--palette-*` primitives instead of roles. | Intentional: both stay dark in either theme. Documented on the two component pages as the only primitive uses. |
| `assets/ui.css` | A few off-grid metrics: `0.375rem` (status dot), `1.375rem` (badge height), `0.65rem` (indeterminate bar), `0.9em`/`1.1em` (skeleton text). | Not snapped: they are glyph and indicator geometry inside components, not layout spacing. Layout spacing already uses `--space-*`. |

## Verification

- `check_mocks.py docs/mocks`: 47 screens, 164 mocks, 0 errors, 0 warnings.
- `check_contrast.py tokens/tokens.css`: 130 pairs passed, 0 failed, both themes.
- `check_design_system.py docs/design-system`: 71 pages (50 components, 8 patterns), 0 errors, 0 warnings.
- Screenshots (Chromium, 360/768/1280 px, light and dark) reviewed for Button, Dialog, Table, and the data-tables and dialogs patterns. The index and foundation pages were not captured, because the screenshot tool only scans mock-style folders.
- Not done: pointing `docs/mocks` at `../design-system/tokens/tokens.css` and `assets/components.css`. The mocks still use their own copies, which differ only by the additions logged above.


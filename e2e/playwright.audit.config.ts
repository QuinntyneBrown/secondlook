import { defineConfig, devices } from "@playwright/test";

/**
 * Responsive-audit configuration — 5 viewports (xsmall → xlarge).
 *
 * Separate from `playwright.config.ts` on purpose: the main config's three
 * projects (mobile/tablet/desktop) name the committed `-win32` visual
 * baselines, so adding projects there would break `test:visual`. This
 * config drives `audit/responsive.audit.spec.ts`, which takes raw
 * `page.screenshot()` captures into `audit-output/` (gitignored) and runs
 * measurement-based overflow assertions — no snapshot files at all.
 *
 * Same two-server switch as the main config:
 *   - default: the Angular dev server on :4200 (app under audit). Guarded
 *     routes need the API on :5100 — run `eng/Start-FreshStack.ps1`.
 *   - SL_BASELINE=1: `http-server` serves docs/mocks-v2 on :5173, auditing
 *     the mocks themselves at the same five widths (no auth, no backend).
 *
 * The five widths straddle every layout regime of the v2 design: 320
 * (below all breakpoints, sitebar "Sign in" link collapses), 390 (phone
 * baseline, bottom nav), 820 (720px top bar + two-column card grids), 1440
 * (1024px two-day grid + three-column cards), 1920 (1120px content cap).
 */

const AUDIT_VIEWPORTS = {
  xsmall: { width: 320, height: 568 },
  small: { width: 390, height: 844 },
  medium: { width: 820, height: 1180 },
  large: { width: 1440, height: 900 },
  xlarge: { width: 1920, height: 1080 },
} as const;

const isBaselineCapture = process.env.SL_BASELINE === "1";

const viewportProjects = (
  Object.keys(AUDIT_VIEWPORTS) as Array<keyof typeof AUDIT_VIEWPORTS>
).map((name) => ({
  name,
  use: { ...devices["Desktop Chrome"], viewport: AUDIT_VIEWPORTS[name] },
  // The mocks need no session; the app audit signs in once via the setup
  // project and reuses the saved storageState.
  dependencies: isBaselineCapture ? [] : ["setup"],
}));

export default defineConfig({
  testDir: "./audit",
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"]],
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: isBaselineCapture
      ? "http://localhost:5173"
      : "http://localhost:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: isBaselineCapture
    ? {
        command:
          "npx http-server ../docs/mocks-v2 -p 5173 -c-1 --cors --silent",
        url: "http://localhost:5173/index.html",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        cwd: __dirname,
      }
    : {
        command: "npm run start -- --port 4200",
        url: "http://localhost:4200",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        cwd: `${__dirname}/../frontend`,
      },
  projects: isBaselineCapture
    ? viewportProjects
    : [
        { name: "setup", testMatch: /auth\.setup\.ts/ },
        ...viewportProjects,
      ],
});

export { AUDIT_VIEWPORTS };

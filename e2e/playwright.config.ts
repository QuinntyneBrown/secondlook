import { defineConfig, devices } from "@playwright/test";

/**
 * Two-server configuration:
 *
 *   - The Angular dev server (the implementation under test) runs on
 *     http://localhost:4200. Behaviour specs and visual verification target
 *     it; guarded routes need the API on :5100 with the seeded accounts:
 *     `pwsh eng/Start-E2eApi.ps1` starts it on a fresh, seeded SQLite file with
 *     no database server (ADR-020); `eng/Start-FreshStack.ps1` still runs the
 *     whole stack on LocalDB.
 *
 *   - SecondLook Admin (ADR-014) runs on http://localhost:4300 for the `admin`
 *     project. Its upload specs need the API's curated store to sit on an
 *     allow-listed origin (`eng/Start-E2eApi.ps1` sets both): start the API with
 *     `SecondLook__CuratedPhotos__PublicOrigin=https://images.example.com` and
 *     `SecondLook__Images__AllowedOrigins__0=https://images.example.com`.
 *
 *   - The v2 mocks (docs/mocks) are served on http://localhost:5173 by
 *     `http-server` when SL_BASELINE=1. Visual baselines are captured from
 *     them once with `npm run baseline` and committed. Subsequent runs
 *     compare the Angular implementation against those baselines
 *     pixel-by-pixel. (`docs/mocks/.verify.mjs` self-serves on :5180, so
 *     the two never collide.)
 *
 * Snapshot path convention: tests under `tests/visual/` use
 * `toHaveScreenshot()` whose baselines live in
 * `tests/visual/<spec>.spec.ts-snapshots/<name>-<project>-win32.png`. The
 * baseline capture shares the same project names as the verify run so they
 * read/write the same files.
 *
 * Parity policy (ADR-010): baselines are only taken of regions whose copy is
 * fixed or seed-derived; dated / weather / planner-driven regions are
 * masked; planner screens never get full-page baselines. Failures are fixed
 * in the components, never by loosening the ratio below.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
} as const;

const isBaselineCapture = process.env.SL_BASELINE === "1";

/** Specs under tests/admin/ run only in the `admin` project (the admin app on :4300). */
const ADMIN_SPECS = /tests[\\/]admin[\\/]/;

/** Specs the three viewport projects skip. */
const OTHER_APP_SPECS = [ADMIN_SPECS];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      // SecondLook targets pixel-perfect parity with the mocks. A handful of
      // sub-pixel rasterisation diffs (font hinting, anti-aliasing) are
      // unavoidable across runs, so we allow a tiny ratio but no per-pixel
      // colour drift.
      maxDiffPixelRatio: 0.005,
      threshold: 0.05,
      animations: "disabled",
      caret: "hide",
    },
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
        command: "npx http-server ../docs/mocks -p 5173 -c-1 --cors --silent",
        url: "http://localhost:5173/index.html",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        cwd: __dirname,
      }
    : [
        {
          command: "npm run start -- --port 4200",
          url: "http://localhost:4200",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          cwd: `${__dirname}/../frontend`,
        },
        // SecondLook Admin (ADR-014): a second app in the workspace on its own port.
        {
          command: "npm run start:admin -- --port 4300",
          url: "http://localhost:4300",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          cwd: `${__dirname}/../frontend`,
        },
      ],
  projects: [
    {
      name: "mobile",
      testIgnore: OTHER_APP_SPECS,
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORTS.mobile },
    },
    {
      name: "tablet",
      testIgnore: OTHER_APP_SPECS,
      use: { ...devices["Desktop Chrome"], viewport: VIEWPORTS.tablet },
    },
    {
      name: "desktop",
      testIgnore: OTHER_APP_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORTS.desktop,
        // Calls run on Chromium's synthetic camera and microphone, with no prompt and no mDNS-hidden addresses,
        // so two browser sessions on one machine can connect to each other.
        permissions: ["camera", "microphone"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--disable-features=WebRtcHideLocalIpsWithMdns",
          ],
        },
      },
    },
    // SecondLook Admin: Chromium only, desktop-first (curators work on laptops);
    // specs that care about narrow widths resize the page themselves.
    {
      name: "admin",
      testMatch: ADMIN_SPECS,
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORTS.desktop,
        baseURL: isBaselineCapture
          ? "http://localhost:5173"
          : "http://localhost:4300",
      },
    },
  ],
});

export { VIEWPORTS };

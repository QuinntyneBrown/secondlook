#!/usr/bin/env node
// Captures the marketing site's images from the real app (ADR-018):
//
//   marketing/assets/screenshots/{weekend,ideas,family,past}.png   phone, 390x844 @2x (780x1688)
//   marketing/assets/screenshots/weekend-desktop.png               desktop, 1440x900 @1x
//   marketing/assets/social-card.png                               1200x630, from social-card.html
//
// and copies them to docs/mocks/images/marketing/ so the mock and the site show the same pixels
// (the visual spec compares the two, ADR-010).
//
//   node tools/marketing-screenshots/capture.mjs
//
// Needs the API on SL_API_URL (default http://localhost:5100) with seeded data and the family app
// on SL_APP_URL (default http://localhost:4200); see tools/video-record/family-demo/README.md for
// a disposable database. Playwright comes from e2e/node_modules.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const { chromium } = createRequire(join(repo, "e2e", "package.json"))(
  "@playwright/test",
);

const APP = process.env.SL_APP_URL ?? "http://localhost:4200";
const API = process.env.SL_API_URL ?? "http://localhost:5100";
const EMAIL = process.env.SL_DEMO_EMAIL ?? "quinntynebrown@gmail.com";
const PASSWORD = process.env.SL_DEMO_PASSWORD ?? "password123";

const site = join(repo, "marketing", "assets");
const mockImages = join(repo, "docs", "mocks", "images", "marketing");

const PHONE_SCREENS = [
  { name: "weekend", path: "/weekend", ready: "sl-day, .planner" },
  { name: "ideas", path: "/ideas", ready: ".card--media" },
  { name: "family", path: "/family", ready: ".page-header__title" },
  { name: "past", path: "/past", ready: ".page-header__title" },
];

async function session(request) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) throw new Error(`login ${EMAIL}: ${res.status()}`);
  const { token } = await res.json();
  const headers = { Authorization: `Bearer ${token.accessToken}` };
  // GET /api/weekends/current plans this weekend when there is none yet.
  const current = await request.get(`${API}/api/weekends/current`, { headers });
  if (!current.ok())
    throw new Error(
      `this weekend: ${current.status()} ${await current.text()}`,
    );
  return {
    value: token.accessToken,
    expiresUtc: token.accessTokenExpiresAtUtc,
    refreshToken: token.refreshToken,
  };
}

async function settle(page, ready) {
  await page.waitForSelector(ready, { timeout: 20_000 });
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => !i.complete)
        .map(
          (i) =>
            new Promise(
              (r) =>
                i.addEventListener("load", r, { once: true }) ||
                i.addEventListener("error", r, { once: true }),
            ),
        ),
    );
  });
  await page.waitForTimeout(800); // map tiles and the last fade
}

async function shoot(browser, token, viewport, scale, screens) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: scale,
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  await context.addInitScript((payload) => {
    localStorage.setItem("sd.auth.token", JSON.stringify(payload));
    localStorage.setItem("sd.auth.storage", "local");
  }, token);
  const page = await context.newPage();
  for (const s of screens) {
    await page.goto(new URL(s.path, APP).href);
    await settle(page, s.ready);
    const out = join(site, "screenshots", `${s.file ?? s.name}.png`);
    await page.screenshot({ path: out });
    console.log(`  ${s.file ?? s.name}.png`);
  }
  await context.close();
}

async function main() {
  mkdirSync(join(site, "screenshots"), { recursive: true });
  mkdirSync(mockImages, { recursive: true });
  const browser = await chromium.launch();
  try {
    const request = (await browser.newContext()).request;
    const token = await session(request);
    await shoot(browser, token, { width: 390, height: 844 }, 2, PHONE_SCREENS);
    await shoot(browser, token, { width: 1440, height: 900 }, 1, [
      { ...PHONE_SCREENS[0], file: "weekend-desktop" },
    ]);

    const card = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      colorScheme: "light",
    });
    await card.goto(pathToFileURL(join(here, "social-card.html")).href);
    await settle(card, ".card");
    await card.screenshot({ path: join(site, "social-card.png") });
    console.log("  social-card.png");
  } finally {
    await browser.close();
  }
  for (const name of [
    "weekend",
    "ideas",
    "family",
    "past",
    "weekend-desktop",
  ]) {
    copyFileSync(
      join(site, "screenshots", `${name}.png`),
      join(mockImages, `${name}.png`),
    );
  }
  console.log("copied the screenshots to docs/mocks/images/marketing/");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

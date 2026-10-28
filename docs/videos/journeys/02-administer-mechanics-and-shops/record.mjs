// Records the J02 implementation demo from the real, locally running stack:
//   clips/app.mp4   the admin app in Chromium: sign in, provider list, onboard (invalid then valid), approve,
//                   deactivate (safe action focused), approve again, and a buyer refused
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/02-administer-mechanics-and-shops/record.mjs
// Local synthetic data only; no email is sent (local mailbox adapter). Stops only its own processes.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-02');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });

const APP = 'http://localhost:4300';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 1.6));
const stamp = Date.now();
const shop = `Rae Gear ${String(stamp).slice(-4)}`;

const startLog = openSync(join(cache, 'start.log'), 'w');
const started = spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] });
if (started.status !== 0) throw new Error('API did not start; see .cache/journey-02/start.log');
const ng = spawn('npm', ['run', 'start:admin', '--', '--port', '4300'], { cwd: join(root, 'frontend'), shell: true, stdio: 'ignore', windowsHide: true });
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(APP)).ok) break;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  const dir = join(cache, 'app');
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
  const page = await context.newPage();
  try {
    const signIn = async (email) => {
      await page.goto(`${APP}/sign-in`);
      await page.getByLabel('Email', { exact: true }).fill(email);
      await page.getByLabel('Password', { exact: true }).fill('Password-123!');
      await sleep(1200);
      await page.getByRole('button', { name: 'Sign in' }).click();
    };
    // Sign in as the administrator; the seeded providers are already approved.
    await signIn('admin@example.test');
    await page.getByRole('heading', { name: 'Providers' }).waitFor();
    await sleep(4500);
    // Onboard: invalid first, then valid.
    await page.getByRole('button', { name: 'Onboard provider' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Onboard a provider' });
    await dialog.getByLabel('Email', { exact: true }).fill('rae@');
    await sleep(1000);
    await dialog.getByRole('button', { name: 'Onboard provider' }).click();
    await dialog.getByRole('alert').waitFor();
    await sleep(4500);
    await dialog.getByLabel('Kind', { exact: true }).selectOption('BodyShop');
    await dialog.getByLabel('Name', { exact: true }).fill(shop);
    await dialog.getByLabel('Email', { exact: true }).fill(`rae.${stamp}@example.test`);
    await dialog.getByLabel('Licence number', { exact: true }).fill('BS-4410');
    await dialog.getByLabel('Location', { exact: true }).fill('Burlington, ON');
    await sleep(1500);
    await dialog.getByRole('button', { name: 'Onboard provider' }).click();
    await page.getByRole('rowheader', { name: shop }).waitFor();
    await sleep(4500);
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: shop }) });
    // Approve.
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog', { name: `Approve ${shop}?` }).waitFor();
    await sleep(3500);
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await row.getByRole('cell', { name: 'Approved', exact: true }).waitFor();
    await sleep(4000);
    // Deactivate: the safe action has focus; confirm.
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await page.getByRole('dialog', { name: `Deactivate ${shop}?` }).waitFor();
    await sleep(5000);
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await row.getByRole('cell', { name: 'Deactivated', exact: true }).waitFor();
    await sleep(4500);
    // Reactivate.
    await row.getByRole('button', { name: 'Approve again' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await row.getByRole('cell', { name: 'Approved', exact: true }).waitFor();
    await sleep(4000);
    // A buyer is refused.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await signIn('buyer@example.test');
    await page.getByRole('heading', { name: 'Administrators only' }).waitFor();
    await sleep(5000);
  } finally {
    await context.close();
    await browser.close();
  }
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, 'app.mp4')]);
  if (r.status !== 0) throw new Error('ffmpeg failed');
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

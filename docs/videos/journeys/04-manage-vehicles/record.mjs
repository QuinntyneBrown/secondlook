// Records the J04 implementation demo from the real, locally running stack:
//   clips/app.mp4   a new buyer's Vehicles page in Chromium: empty, invalid add, add, duplicate, edit, remove
//   clips/api.mp4   real API calls: another buyer cannot see, read or change the first buyer's vehicle
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/04-manage-vehicles/record.mjs
// Local synthetic data only. Stops only the processes it starts.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-04');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 0.9));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]');
const PASSWORD = 'a-long-password';
const stamp = Date.now();
const email = `vera.${stamp}@example.test`;
const vin = `2HGFC2F59GH${String(stamp % 1_000_000).padStart(6, '0')}`;

const json = (body, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const mailboxToken = async (to) => (await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(to)}&purpose=verify-email`)).json()).token;

function toMp4(dir, name) {
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`)]);
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
}

async function recordPage(name, body) {
  const dir = join(cache, name);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
  const page = await context.newPage();
  try {
    await body(page);
  } finally {
    await context.close();
    await browser.close();
  }
  toMp4(dir, name);
}

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-04/start.log');
const ng = spawn('npm', ['run', 'start', '--', '--port', '4200'], { cwd: join(root, 'frontend'), shell: true, stdio: 'ignore', windowsHide: true });
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(APP)).ok) break;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  // A new buyer, verified through the local mailbox.
  await fetch(`${API}/api/auth/register`, json({ fullName: 'Vera Vehicle', email, password: PASSWORD, acceptedTerms: true }));
  await fetch(`${API}/api/auth/verify-email`, json({ token: await mailboxToken(email) }));

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(1000);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('link', { name: 'Vehicles' }).click();
    await page.getByRole('heading', { name: 'No saved vehicles yet' }).waitFor();
    await sleep(3500);
    // Invalid add.
    await page.getByRole('button', { name: 'Add a vehicle' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add a vehicle' });
    const fill = async (v) => {
      await dialog.getByLabel('VIN', { exact: true }).fill(v.vin);
      await dialog.getByLabel('Odometer (km)', { exact: true }).fill('142300');
      await dialog.getByLabel('Asking price ($)', { exact: true }).fill('8900');
      await dialog.getByLabel('Listing link (optional)', { exact: true }).fill('https://example.test/civic');
      await dialog.getByLabel('Seller’s name', { exact: true }).fill('Sam Whitaker');
      await dialog.getByLabel('Seller’s phone', { exact: true }).fill(v.phone);
    };
    await fill({ vin: vin.slice(0, 15), phone: '905-555-01' });
    await sleep(1500);
    await dialog.getByRole('button', { name: 'Save vehicle' }).click();
    await dialog.getByRole('alert').waitFor();
    await sleep(5000);
    await fill({ vin, phone: '905-555-0142' });
    await sleep(1200);
    await dialog.getByRole('button', { name: 'Save vehicle' }).click();
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: vin }) });
    await row.waitFor();
    await sleep(3500);
    // Duplicate.
    await page.getByRole('button', { name: 'Add a vehicle' }).first().click();
    await fill({ vin, phone: '905-555-0142' });
    await dialog.getByRole('button', { name: 'Save vehicle' }).click();
    await dialog.getByRole('alert').waitFor();
    await sleep(4000);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    // Edit.
    await row.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit vehicle' });
    await edit.getByLabel('Odometer (km)', { exact: true }).fill('150000');
    await edit.getByLabel('Asking price ($)', { exact: true }).fill('8400');
    await sleep(1500);
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await row.getByRole('cell', { name: '150,000 km', exact: true }).waitFor();
    await sleep(3500);
    // Remove.
    await row.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('dialog', { name: /^Remove / }).waitFor();
    await sleep(4500);
    await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('heading', { name: 'No saved vehicles yet' }).waitFor();
    await sleep(3500);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const login = async (e, p) => (await (await fetch(`${API}/api/auth/login`, json({ email: e, password: p }))).json()).token;
    const owner = await login(email, PASSWORD);
    const other = await login('buyer@example.test', 'Password-123!');
    const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
    const created = await (await fetch(`${API}/api/vehicles`, json({ vin: `${vin.slice(0, 16)}9`, odometerKm: 90000, askingPrice: 5000, sellerName: 'Owner Seller', sellerPhone: '9055550100' }, owner))).json();
    await say(`POST /api/vehicles   (${email.split('@')[0]}, saves a vehicle)`, 'cmd');
    await say(`HTTP 201  ${created.vin}`, 'ok');
    await sleep(3100);
    const step = async (label, path, token, method = 'GET') => {
      await say(label, 'cmd');
      await sleep(500);
      const res = await fetch(`${API}${path}`, { method, ...authed(token) });
      const text = (await res.text()).slice(0, 120);
      await say(`HTTP ${res.status}${text ? '  ' + text : ''}`, res.ok ? 'ok' : 'bad');
      await sleep(3100);
    };
    await step('GET /api/vehicles   (another buyer)', '/api/vehicles', other);
    await step('GET /api/vehicles/{id}   (another buyer)', `/api/vehicles/${created.id}`, other);
    await step('DELETE /api/vehicles/{id}   (another buyer)', `/api/vehicles/${created.id}`, other, 'DELETE');
    await step('GET /api/vehicles/{id}   (the owner)', `/api/vehicles/${created.id}`, owner);
    await step('DELETE /api/vehicles/{id}   (the owner)', `/api/vehicles/${created.id}`, owner, 'DELETE');
    await sleep(2000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

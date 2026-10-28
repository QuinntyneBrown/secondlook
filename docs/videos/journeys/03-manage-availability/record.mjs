// Records the J03 implementation demo from the real, locally running stack:
//   clips/app.mp4   the mechanic's availability page in Chromium: validation, add, overlap refused, edit
//   clips/api.mp4   real API calls: a buyer lists slots, an administrator deactivates the mechanic and the slots vanish
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/03-manage-availability/record.mjs
// Local synthetic data only. Stops only the processes it starts.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-03');
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
const PASSWORD = 'Password-123!';
const DAY = '2031-06-02';

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

const login = async (email) => (await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) })).json()).token;

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-03/start.log');
const ng = spawn('npm', ['run', 'start', '--', '--port', '4200'], { cwd: join(root, 'frontend'), shell: true, stdio: 'ignore', windowsHide: true });
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(APP)).ok) break;
    } catch {
      // not up yet
    }
    await sleep(600);
  }

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill('mechanic@example.test');
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(1200);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Your availability' }).waitFor();
    await sleep(3500);
    // Invalid, then valid.
    await page.getByRole('button', { name: 'Add availability' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add availability' });
    await dialog.getByLabel('Day', { exact: true }).fill(DAY);
    await dialog.getByLabel('Start (Eastern Time)', { exact: true }).fill('14:10');
    await dialog.getByLabel('End (Eastern Time)', { exact: true }).fill('13:00');
    await sleep(1500);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await dialog.getByRole('alert').waitFor();
    await sleep(4500);
    await dialog.getByLabel('Start (Eastern Time)', { exact: true }).fill('14:00');
    await dialog.getByLabel('End (Eastern Time)', { exact: true }).fill('18:00');
    await sleep(1500);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('rowheader', { name: 'Mon 2 Jun 2031' }).waitFor();
    await sleep(4500);
    // Overlap is refused.
    await page.getByRole('button', { name: 'Add availability' }).first().click();
    const again = page.getByRole('dialog', { name: 'Add availability' });
    await again.getByLabel('Day', { exact: true }).fill(DAY);
    await again.getByLabel('Start (Eastern Time)', { exact: true }).fill('17:00');
    await again.getByLabel('End (Eastern Time)', { exact: true }).fill('19:00');
    await sleep(1200);
    await again.getByRole('button', { name: 'Save', exact: true }).click();
    await again.getByRole('alert').waitFor();
    await sleep(4500);
    await again.getByRole('button', { name: 'Cancel' }).click();
    // Edit: start earlier.
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Mon 2 Jun 2031' }) });
    await row.getByRole('button', { name: 'Edit' }).click();
    const edit = page.getByRole('dialog', { name: 'Edit availability' });
    await edit.getByLabel('Start (Eastern Time)', { exact: true }).fill('13:00');
    await sleep(1500);
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await row.getByRole('cell', { name: '1:00 PM – 6:00 PM', exact: true }).waitFor();
    await sleep(5000);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const buyer = await login('buyer@example.test');
    const admin = await login('admin@example.test');
    const get = async (label, path, token, summarise) => {
      await say(label, 'cmd');
      await sleep(700);
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => null);
      await say(`HTTP ${res.status}`, res.ok ? 'ok' : 'bad');
      if (body) await say(summarise(body), 'out');
      await sleep(3800);
    };
    const slots = (b) => `${b.slots.length} slots, ${b.timeZone}: ` + b.slots.slice(0, 3).map((s) => `${s.providerName} ${s.start.slice(0, 16)}Z`).join(' · ') + (b.slots.length > 3 ? ' …' : '');
    const q = `/api/slots?from=${DAY}T00:00:00Z&to=${DAY}T23:59:00Z&kind=Mechanic`;
    await get('GET /api/slots   (buyer)', q, buyer, slots);
    await say('POST /api/admin/providers/{mechanic}/deactivate   (admin)', 'cmd');
    await sleep(700);
    const r = await fetch(`${API}/api/admin/providers/00000000-0000-0000-0000-000000000c01/deactivate`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` } });
    await say(`HTTP ${r.status}`, r.ok ? 'ok' : 'bad');
    await sleep(3000);
    await get('GET /api/slots   (buyer)', q, buyer, slots);
    await fetch(`${API}/api/admin/providers/00000000-0000-0000-0000-000000000c01/approve`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` } });
    await say('POST /api/admin/providers/{mechanic}/approve   (admin)', 'cmd');
    await sleep(2500);
    await get('GET /api/slots   (buyer)', q, buyer, slots);
    await sleep(3000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

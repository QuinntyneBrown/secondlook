// Records the J09 implementation demo from the real, locally running stack:
//   clips/app.mp4   a buyer books a combined mechanic + body shop call for $70
//   clips/api.mp4   real API calls: slots by kind, an all-or-nothing combined hold, and a refused mismatch
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/09-add-body-shop-review/record.mjs
// Local synthetic data and the LOCAL payment adapter only: nothing is ever charged.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-09');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 1.05));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]').replace(/tok_local_[0-9a-f]+/g, 'tok_local_…');
const PASSWORD = 'a-long-password';
const stamp = Date.now();

const post = (body, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const login = async (email, password) => (await (await fetch(`${API}/api/auth/login`, post({ email, password }))).json()).token;
async function newBuyer(address, name) {
  await fetch(`${API}/api/auth/register`, post({ fullName: name, email: address, password: PASSWORD, acceptedTerms: true }));
  const mail = await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(address)}&purpose=verify-email`)).json();
  await fetch(`${API}/api/auth/verify-email`, post({ token: mail.token }));
  return login(address, PASSWORD);
}

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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-09/start.log');
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
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  const shop = await login('bodyshop@example.test', 'Password-123!');
  const base = new Date();
  const at = (days, hour, minute = 0) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, hour, minute, 0));
  const open = (token, start, minutes) => fetch(`${API}/api/availability`, post({ start: start.toISOString(), end: new Date(start.getTime() + minutes * 60e3).toISOString() }, token));
  // The mechanic is free from 15:00 UTC for an hour, the body shop from 15:30: the only shared start is 15:30.
  const mech = at(6, 15);
  await open(mechanic, mech, 60);
  const shared = new Date(mech.getTime() + 30 * 60e3);
  await open(shop, shared, 60);
  // A second pair of windows, a day later, for the API scene.
  const mech2 = at(7, 15);
  await open(mechanic, mech2, 60);
  await open(shop, new Date(mech2.getTime() + 30 * 60e3), 60);

  const eastern = (d, o, t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', ...o }).formatToParts(d).find((p) => p.type === t).value;
  const clock = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeOf = (d) => `${eastern(d, clock, 'hour')}:${eastern(d, clock, 'minute')} ${eastern(d, clock, 'dayPeriod').toUpperCase().replace(/\./g, '')}`;
  const dayOf = (d) => `${eastern(d, { weekday: 'short' }, 'weekday')} ${eastern(d, { day: 'numeric' }, 'day')} ${eastern(d, { month: 'short' }, 'month')}`;

  const email = `bea.${stamp}@example.test`;
  await newBuyer(email, 'Bea Bodyshop');
  const vin = `2HGFC2F59GH${String(stamp % 1_000_000).padStart(6, '0')}`;

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(800);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('link', { name: 'Book an inspection' }).first().waitFor();
    await sleep(2500);
    await page.getByRole('link', { name: 'Book an inspection' }).first().click();
    await page.getByLabel('VIN', { exact: true }).fill(vin);
    await page.getByLabel('Odometer (km)', { exact: true }).fill('98000');
    await page.getByLabel('Asking price ($)', { exact: true }).fill('6400');
    await page.getByLabel('Seller’s name', { exact: true }).fill('Sam Whitaker');
    await page.getByLabel('Seller’s phone', { exact: true }).fill('905-555-0142');
    await sleep(1500);
    await page.getByRole('button', { name: 'Continue to review type' }).click();
    await page.getByText('Pick the review that fits the car.').waitFor();
    await sleep(2600);
    await page.getByRole('radio', { name: /^Body shop/ }).check();
    await sleep(3000);
    await page.getByRole('radio', { name: /^Both/ }).check();
    await page.getByRole('region', { name: 'Your order' }).getByText('Total $70.00', { exact: true }).waitFor();
    await sleep(3600);
    await page.getByRole('button', { name: 'Continue to scheduling' }).click();
    await page.getByRole('button', { name: dayOf(shared), exact: true }).waitFor();
    await sleep(3100);
    await page.getByRole('button', { name: dayOf(shared), exact: true }).click();
    await sleep(1500);
    await page.getByRole('button', { name: timeOf(shared), exact: true }).click();
    await page.getByText('Bo Bodyshop', { exact: true }).waitFor();
    await sleep(5100);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.getByRole('button', { name: 'Pay $70', exact: true }).waitFor();
    await page.getByLabel('Card number', { exact: true }).fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry', { exact: true }).fill('12 / 34');
    await page.getByLabel('Security code', { exact: true }).fill('123');
    await page.getByLabel('Name on card', { exact: true }).fill('Bea Bodyshop');
    await page.getByLabel('Postal code', { exact: true }).fill('L8P 1A1');
    await page.getByRole('checkbox', { name: /I’ve told the seller/ }).check();
    await sleep(2000);
    await page.getByRole('button', { name: 'Pay $70', exact: true }).click();
    await page.getByRole('heading', { name: /^You’re booked for/ }).waitFor();
    await sleep(4100);
    await page.getByRole('link', { name: 'View inspection' }).click();
    await page.getByText('Bo Bodyshop · Body shop', { exact: true }).waitFor();
    await sleep(5100);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const token = await newBuyer(`val.${stamp}@example.test`, 'Val Verifier');
    const from = new Date(mech2.getTime() - 3600e3).toISOString();
    const to = new Date(mech2.getTime() + 4 * 3600e3).toISOString();
    const slots = async (kind) => (await (await fetch(`${API}/api/slots?kind=${kind}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, authed(token))).json()).slots;
    const list = async (kind) => {
      await say(`GET /api/slots?kind=${kind}`, 'cmd');
      await sleep(800);
      const s = await slots(kind);
      await say(`${s.length} free: ${s.map((x) => `${eastern(new Date(x.start), clock, 'hour')}:${eastern(new Date(x.start), clock, 'minute')} ${x.providerName}${x.bodyShopName ? ' + ' + x.bodyShopName : ''}`).join(' | ')}`, 'ok');
      await sleep(4000);
      return s;
    };
    await list('Mechanic');
    await list('BodyShop');
    const both = await list('Both');
    await say('POST /api/bookings/holds   mechanic + body shop at the shared time', 'cmd');
    await sleep(800);
    const r = await fetch(`${API}/api/bookings/holds`, post({ providerId: both[0].providerId, start: both[0].start, bodyShopId: both[0].bodyShopId }, token));
    const hold = await r.json();
    await say(`${r.status} Created: both slots held (${hold.providerName} + ${hold.bodyShopName})`, 'ok');
    await sleep(4000);
    const rival = await newBuyer(`rival.${stamp}@example.test`, 'Rae Rival');
    await say('A second buyer asks for the same combined time', 'cmd');
    await sleep(800);
    const r2 = await fetch(`${API}/api/bookings/holds`, post({ providerId: both[0].providerId, start: both[0].start, bodyShopId: both[0].bodyShopId }, rival));
    await say(`${r2.status} Conflict: We couldn’t hold that slot`, 'note');
    await sleep(4500);
    await say('GET /api/slots?kind=Both   (nothing left shared)', 'cmd');
    await sleep(800);
    const after = await (await fetch(`${API}/api/slots?kind=Both&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, authed(rival))).json();
    await say(`${after.slots.length} free`, 'ok');
    await sleep(5000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

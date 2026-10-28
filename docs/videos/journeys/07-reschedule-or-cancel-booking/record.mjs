// Records the J07 implementation demo from the real, locally running stack:
//   clips/app.mp4   a buyer reschedules (with undo) and cancels a booked inspection in Chromium
//   clips/api.mp4   real API calls: a taken slot refuses a reschedule; five simultaneous cancellations refund once
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/07-reschedule-or-cancel-booking/record.mjs
// Local synthetic data and the LOCAL payment adapter only: nothing is ever charged or refunded for real.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-07');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const MECHANIC = '00000000-0000-0000-0000-000000000c01';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 0.9));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]').replace(/tok_local_[0-9a-f]+/g, 'tok_local_…');
const PASSWORD = 'a-long-password';
const stamp = Date.now();

const post = (body, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const mailboxToken = async (to) => (await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(to)}&purpose=verify-email`)).json()).token;
const login = async (email, password) => (await (await fetch(`${API}/api/auth/login`, post({ email, password }))).json()).token;
async function newBuyer(address, name) {
  await fetch(`${API}/api/auth/register`, post({ fullName: name, email: address, password: PASSWORD, acceptedTerms: true }));
  await fetch(`${API}/api/auth/verify-email`, post({ token: await mailboxToken(address) }));
  return login(address, PASSWORD);
}

/** Books the slot at `start` for a buyer through the API and returns the inspection. */
async function book(token, start, n) {
  const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin: `2HGFC2F59GH${String((stamp + n) % 1_000_000).padStart(6, '0')}`, odometerKm: 90000, askingPrice: 5000, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
  const hold = await (await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC, start }, token))).json();
  const checkout = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `k-${stamp}-${n}`, vehicleId: vehicle.id }, token))).json();
  const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: 'Mo Mover', postalCode: 'L8P 1A1' }, token))).json();
  await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
  return (await fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id }, token))).json();
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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-07/start.log');
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
  const day = (n, hour) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + n, hour, 0, 0));
  // Two 2-hour windows a few days ahead: one for the UI scenes, one for the API scenes.
  const wins = [day(4, 15), day(6, 15)];
  for (const s of wins) await fetch(`${API}/api/availability`, post({ start: s.toISOString(), end: new Date(s.getTime() + 2 * 3600e3).toISOString() }, mechanic));

  const email = `mo.${stamp}@example.test`;
  const buyer = await newBuyer(email, 'Mo Mover');
  const inspection = await book(buyer, wins[0].toISOString(), 1);
  const second = new Date(wins[0].getTime() + 30 * 60e3).toISOString();
  const eastern = (iso, o, t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', ...o }).formatToParts(new Date(iso)).find((p) => p.type === t).value;
  const o = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeText = (iso) => `${eastern(iso, o, 'hour')}:${eastern(iso, o, 'minute')} ${eastern(iso, o, 'dayPeriod').toUpperCase().replace(/\./g, '')}`;
  const dayText = (iso) => `${eastern(iso, { weekday: 'short' }, 'weekday')} ${eastern(iso, { day: 'numeric' }, 'day')} ${eastern(iso, { month: 'short' }, 'month')}`;

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(900);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Your inspections' }).waitFor();
    await sleep(2500);
    await page.getByRole('link', { name: inspection.vehicle.vin }).click();
    await page.getByText(/^Scheduled ·/).waitFor();
    await sleep(3500);
    // Reschedule, with undo.
    await page.getByRole('button', { name: 'Reschedule' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pick a new time' });
    await dialog.waitFor();
    await sleep(3000);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).click();
    await dialog.getByText('Choose a new time.').waitFor();
    await sleep(3500);
    await dialog.getByRole('button', { name: dayText(second), exact: true }).click();
    await dialog.getByRole('button', { name: timeText(second), exact: true }).click();
    await sleep(2000);
    await dialog.getByRole('button', { name: 'Reschedule', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Rescheduled to' }).waitFor();
    await sleep(5000);
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByText(new RegExp(`Scheduled · .*${timeText(wins[0].toISOString())}`)).waitFor();
    await sleep(3500);
    // Cancel with a reason.
    await page.getByRole('button', { name: 'Cancel inspection' }).click();
    const cancel = page.getByRole('dialog', { name: /^Cancel the .* inspection\?$/ });
    await cancel.waitFor();
    await sleep(5000);
    await cancel.getByRole('button', { name: 'Cancel inspection' }).click();
    await cancel.getByText('Choose a reason so we can improve.').waitFor();
    await sleep(3500);
    await cancel.getByRole('radio', { name: 'I bought a different car' }).check();
    await sleep(1500);
    await cancel.getByRole('button', { name: 'Cancel inspection' }).click();
    await page.getByText(/^Cancelled on/).waitFor();
    await sleep(5500);
    await page.getByRole('link', { name: 'All inspections' }).click();
    await page.getByRole('tab', { name: 'Past' }).click();
    await page.getByRole('link', { name: inspection.vehicle.vin }).waitFor();
    await sleep(4500);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const tokenA = await newBuyer(`ann.${stamp}@example.test`, 'Ann Buyer');
    const tokenB = await newBuyer(`bob.${stamp}@example.test`, 'Bob Buyer');
    const base = wins[1];
    const a = await book(tokenA, base.toISOString(), 2);
    const target = new Date(base.getTime() + 60 * 60e3).toISOString();
    await say('Another buyer holds the time Ann wants to move to', 'cmd');
    await sleep(700);
    const held = await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC, start: target }, tokenB));
    await say(`HTTP ${held.status}`, 'ok');
    await sleep(4000);
    await say('POST /api/inspections/{id}/reschedule   (Ann, into the taken time)', 'cmd');
    await sleep(700);
    const moved = await fetch(`${API}/api/inspections/${a.id}/reschedule`, post({ start: target }, tokenA));
    await say(`HTTP ${moved.status}  ${(await moved.json()).title}`, 'bad');
    await say('(her original time is still booked)', 'note');
    await sleep(5500);
    await say('5 simultaneous POST /api/inspections/{id}/cancel', 'cmd');
    await sleep(700);
    const cancels = await Promise.all(Array.from({ length: 5 }, () => fetch(`${API}/api/inspections/${a.id}/cancel`, post({ reason: 'DifferentCar' }, tokenA))));
    const bodies = await Promise.all(cancels.map((r) => r.json()));
    await say(`HTTP ${cancels.map((r) => r.status).join(' ')}`, 'ok');
    await say(`status ${bodies[0].status}, refunded $${(bodies[0].refundedCents / 100).toFixed(2)} (same in all five)`, 'note');
    await sleep(5200);
    const receipts = await (await fetch(`${API}/api/billing/receipts`, authed(tokenA))).json();
    await say('GET /api/billing/receipts', 'cmd');
    await sleep(700);
    await say(`${receipts.receipts.length} receipt: ${receipts.receipts[0].for}, $${(receipts.receipts[0].amountCents / 100).toFixed(2)}, ${receipts.receipts[0].status}`, 'note');
    await sleep(6000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

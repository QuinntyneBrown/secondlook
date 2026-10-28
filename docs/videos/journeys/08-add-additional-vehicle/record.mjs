// Records the J08 implementation demo from the real, locally running stack:
//   clips/app.mp4   a buyer with one booked car adds a second car for $45 (both reviews) from the dashboard banner
//   clips/api.mp4   real API calls: the server's window decides the price (none -> $50, open -> $25)
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/08-add-additional-vehicle/record.mjs
// Local synthetic data and the LOCAL payment adapter only: nothing is ever charged.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-08');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const MECHANIC = '00000000-0000-0000-0000-000000000c01';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 1.05));
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
async function pay(token, review, vehicleId, key) {
  const checkout = await (await fetch(`${API}/api/checkouts`, post({ review, idempotencyKey: key, vehicleId }, token))).json();
  const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: 'Wendy Window', postalCode: 'L8P 1A1' }, token))).json();
  await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
  return checkout;
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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-08/start.log');
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
  const win = day(5, 15);
  await fetch(`${API}/api/availability`, post({ start: win.toISOString(), end: new Date(win.getTime() + 2 * 3600e3).toISOString() }, mechanic));

  // A buyer with one booked inspection (so a window is open).
  const email = `wendy.${stamp}@example.test`;
  const buyer = await newBuyer(email, 'Wendy Window');
  const v1 = await (await fetch(`${API}/api/vehicles`, post({ vin: `2HGFC2F59GH${String(stamp % 1_000_000).padStart(6, '0')}`, odometerKm: 142300, askingPrice: 8900, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, buyer))).json();
  const hold = await (await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC, start: win.toISOString() }, buyer))).json();
  const co = await pay(buyer, 'Mechanic', v1.id, `first-${stamp}`);
  await fetch(`${API}/api/bookings`, post({ checkoutId: co.id, holdId: hold.holdId, vehicleId: v1.id }, buyer));
  const second = new Date(win.getTime() + 30 * 60e3).toISOString();
  const eastern = (iso, o, t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', ...o }).formatToParts(new Date(iso)).find((p) => p.type === t).value;
  const o = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeText = `${eastern(second, o, 'hour')}:${eastern(second, o, 'minute')} ${eastern(second, o, 'dayPeriod').toUpperCase().replace(/\./g, '')}`;
  const dayText = `${eastern(second, { weekday: 'short' }, 'weekday')} ${eastern(second, { day: 'numeric' }, 'day')} ${eastern(second, { month: 'short' }, 'month')}`;
  const vin2 = `2T1BURHE5HC${String((stamp + 3) % 1_000_000).padStart(6, '0')}`;

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(900);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('region', { name: 'Pricing window' }).waitFor();
    await sleep(5000);
    await page.getByRole('button', { name: 'Add another car · $25' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add another car for $25' });
    await dialog.waitFor();
    await sleep(3500);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await sleep(3500);
    await dialog.getByRole('radio', { name: /^Both/ }).check();
    await dialog.getByLabel('VIN of the next car', { exact: true }).fill(vin2);
    await sleep(2000);
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // The booking flow opens with the VIN filled in.
    await page.getByLabel('Odometer (km)', { exact: true }).fill('118450');
    await page.getByLabel('Asking price ($)', { exact: true }).fill('9600');
    await page.getByLabel('Seller’s name', { exact: true }).fill('Lee Chen');
    await page.getByLabel('Seller’s phone', { exact: true }).fill('289-555-0120');
    await sleep(2500);
    await page.getByRole('button', { name: 'Continue to review type' }).click();
    await page.getByRole('region', { name: 'Your order' }).getByText('Total $45.00', { exact: true }).waitFor();
    await sleep(5000);
    await page.getByRole('button', { name: 'Continue to scheduling' }).click();
    await page.getByRole('button', { name: dayText, exact: true }).click();
    await page.getByRole('button', { name: timeText, exact: true }).click();
    await sleep(2500);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    await page.getByRole('button', { name: 'Pay $45', exact: true }).waitFor();
    await page.getByLabel('Card number', { exact: true }).fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry', { exact: true }).fill('12 / 34');
    await page.getByLabel('Security code', { exact: true }).fill('123');
    await page.getByLabel('Name on card', { exact: true }).fill('Wendy Window');
    await page.getByLabel('Postal code', { exact: true }).fill('L8P 1A1');
    await page.getByRole('checkbox', { name: /I’ve told the seller/ }).check();
    await sleep(2000);
    await page.getByRole('button', { name: 'Pay $45', exact: true }).click();
    await page.getByRole('heading', { name: /^You’re booked for/ }).waitFor();
    await sleep(3500);
    await page.goto(`${APP}/inspections`);
    await page.getByRole('status').filter({ hasText: 'added for $45' }).waitFor();
    await sleep(6000);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const token = await newBuyer(`vic.${stamp}@example.test`, 'Vic Newbuyer');
    const get = async (label) => {
      await say(label, 'cmd');
      await sleep(1330);
      const w = await (await fetch(`${API}/api/pricing-window`, authed(token))).json();
      await say(`state ${w.state}, cars in window ${w.carsInWindow}, ends ${w.endsAt ? w.endsAt.slice(0, 10) : 'n/a'}`, 'ok');
      await sleep(6080);
    };
    const quote = async (label) => {
      await say(label, 'cmd');
      await sleep(1330);
      const c = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `q-${Math.random()}` }, token))).json();
      await say(`quote $${(c.quote.totalCents / 100).toFixed(2)}  (${c.quote.lines[0].label})`, 'note');
      await sleep(5700);
    };
    await get('GET /api/pricing-window   (new buyer)');
    await quote('POST /api/checkouts   Mechanic review');
    await say('Pay for that first inspection (local card 4242)', 'cmd');
    await pay(token, 'Mechanic', undefined, `vic-${stamp}`);
    await sleep(4750);
    await get('GET /api/pricing-window   (after paying)');
    await quote('POST /api/checkouts   Mechanic review, another car');
    await sleep(6650);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

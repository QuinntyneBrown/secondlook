// Records the J06 implementation demo from the real, locally running stack:
//   clips/app.mp4   a new buyer books a video inspection in Chromium: vehicle, review, time, payment, confirmation, dashboard
//   clips/api.mp4   real API calls: two buyers race for one slot (one wins), and a repeated confirmation returns one inspection
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/06-book-a-video-inspection/record.mjs
// Local synthetic data and the LOCAL payment adapter only: nothing is ever charged and no email is sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-06');
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
const mailboxToken = async (to) => (await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(to)}&purpose=verify-email`)).json()).token;
async function newBuyer(address, name) {
  await fetch(`${API}/api/auth/register`, post({ fullName: name, email: address, password: PASSWORD, acceptedTerms: true }));
  await fetch(`${API}/api/auth/verify-email`, post({ token: await mailboxToken(address) }));
  return (await (await fetch(`${API}/api/auth/login`, post({ email: address, password: PASSWORD }))).json()).token;
}
const login = async (email, password) => (await (await fetch(`${API}/api/auth/login`, post({ email, password }))).json()).token;

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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-06/start.log');
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

  // The mechanic's availability: two 2-hour windows a few days ahead (one for each scene).
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
  const day = (n, hour) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + n, hour, 0, 0));
  const windows = [day(4, 15), day(6, 15)];
  for (const start of windows) await fetch(`${API}/api/availability`, post({ start: start.toISOString(), end: new Date(start.getTime() + 2 * 3600e3).toISOString() }, mechanicToken));
  const slotIso = windows[0].toISOString();

  const email = `bea.${stamp}@example.test`;
  await newBuyer(email, 'Bea Booker');
  const vin = `2HGFC2F59GH${String(stamp % 1_000_000).padStart(6, '0')}`;
  const toEastern = (iso, o) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', ...o }).formatToParts(new Date(iso));
  const part = (iso, o, t) => toEastern(iso, o).find((p) => p.type === t).value;
  const dayChip = `${part(slotIso, { weekday: 'short' }, 'weekday')} ${part(slotIso, { day: 'numeric' }, 'day')} ${part(slotIso, { month: 'short' }, 'month')}`;
  const o = { hour: 'numeric', minute: '2-digit', hour12: true };
  const timeText = `${part(slotIso, o, 'hour')}:${part(slotIso, o, 'minute')} ${part(slotIso, o, 'dayPeriod').toUpperCase().replace(/\./g, '')}`;

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(900);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'No inspections yet' }).waitFor();
    await sleep(3500);
    await page.getByRole('link', { name: 'Book an inspection' }).first().click();
    // Vehicle: too short first, then valid.
    await page.getByLabel('VIN', { exact: true }).fill(vin.slice(0, 15));
    await page.getByLabel('Odometer (km)', { exact: true }).fill('142300');
    await page.getByLabel('Asking price ($)', { exact: true }).fill('8900');
    await page.getByLabel('Seller’s name', { exact: true }).fill('Sam Whitaker');
    await page.getByLabel('Seller’s phone', { exact: true }).fill('905-555-01');
    await sleep(1500);
    await page.getByRole('button', { name: 'Continue to review type' }).click();
    await page.getByRole('alert').filter({ hasText: 'Fix 2 things to continue' }).waitFor();
    await sleep(4500);
    await page.getByLabel('VIN', { exact: true }).fill(vin);
    await page.getByLabel('Seller’s phone', { exact: true }).fill('905-555-0142');
    await sleep(1200);
    await page.getByRole('button', { name: 'Continue to review type' }).click();
    // Review.
    await page.getByRole('radio', { name: /^Both/ }).check();
    await page.getByRole('region', { name: 'Your order' }).getByText('Total $70.00', { exact: true }).waitFor();
    await sleep(4500);
    await page.getByRole('button', { name: 'Continue to scheduling' }).click();
    // Schedule.
    await page.getByRole('button', { name: dayChip, exact: true }).waitFor();
    await sleep(2500);
    await page.getByRole('button', { name: dayChip, exact: true }).click();
    await page.getByRole('button', { name: timeText, exact: true }).click();
    await sleep(3500);
    await page.getByRole('button', { name: 'Continue to payment' }).click();
    // Pay.
    await page.getByRole('button', { name: 'Pay $70', exact: true }).waitFor();
    await page.getByLabel('Card number', { exact: true }).fill('4242 4242 4242 4242');
    await page.getByLabel('Expiry', { exact: true }).fill('12 / 34');
    await page.getByLabel('Security code', { exact: true }).fill('123');
    await page.getByLabel('Name on card', { exact: true }).fill('Bea Booker');
    await page.getByLabel('Postal code', { exact: true }).fill('L8P 1A1');
    await page.getByRole('checkbox', { name: /I’ve told the seller/ }).check();
    await sleep(2500);
    await page.getByRole('button', { name: 'Pay $70', exact: true }).click();
    // Confirmation, detail and dashboard.
    await page.getByRole('heading', { name: /^You’re booked for/ }).waitFor();
    await sleep(5500);
    await page.getByRole('link', { name: 'View inspection' }).click();
    await page.getByText(/^Scheduled ·/).waitFor();
    await sleep(4500);
    await page.getByRole('link', { name: 'All inspections' }).click();
    await page.getByRole('tab', { name: /^Active/ }).waitFor();
    await sleep(5000);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const a = await newBuyer(`ana.${stamp}@example.test`, 'Ana Buyer');
    const b = await newBuyer(`ben.${stamp}@example.test`, 'Ben Buyer');
    const start = windows[1].toISOString();
    await say('Two buyers hold the same slot at the same moment', 'cmd');
    await sleep(900);
    const [ra, rb] = await Promise.all([a, b].map((t) => fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC, start }, t))));
    const holds = [ra, rb];
    const winner = holds.findIndex((r) => r.status === 201);
    await say(`Ana: HTTP ${ra.status}   Ben: HTTP ${rb.status}`, 'ok');
    await say(holds.map((r) => r.status).includes(409) ? 'one 201, one 409: "We couldn’t hold that slot"' : 'unexpected result', 'note');
    await sleep(4500);
    const token = winner === 0 ? a : b;
    const hold = await holds[winner].json();
    const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin: `2HGFC2F59GH${String((stamp + 7) % 1_000_000).padStart(6, '0')}`, odometerKm: 90000, askingPrice: 5000, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
    const checkout = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `k-${stamp}`, vehicleId: vehicle.id }, token))).json();
    const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: 'Buyer', postalCode: 'L8P 1A1' }, token))).json();
    await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
    await say('Pay $50, then confirm the booking 5 times at once', 'cmd');
    await sleep(900);
    const confirms = await Promise.all(Array.from({ length: 5 }, () => fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id }, token))));
    const bodies = await Promise.all(confirms.map((r) => r.json()));
    await say(`HTTP ${confirms.map((r) => r.status).join(' ')}`, 'ok');
    await say(`inspection ids: ${[...new Set(bodies.map((x) => x.id.slice(0, 8)))].join(', ')}…  (one inspection)`, 'note');
    await sleep(4500);
    const list = await (await fetch(`${API}/api/inspections`, { headers: { Authorization: `Bearer ${token}` } })).json();
    await say('GET /api/inspections', 'cmd');
    await sleep(700);
    await say(`${list.inspections.length} inspection, ${list.inspections[0].status}, ${list.inspections[0].mechanicName}`, 'note');
    await sleep(5000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

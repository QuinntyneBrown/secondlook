// Records the J14 implementation demo from the real, locally running stack:
//   clips/history.mp4  Active and Past, a completed report and a cancelled inspection opened from the list, Back keeping the tab
//   clips/long.mp4     a long history in pages of twenty
//   clips/states.mp4   no inspections and the sample report, a list that fails to load and recovers, and the busy list
//   clips/api.mp4      real API calls: the tabs and counts, a page past the end, another buyer, a bad tab, the refused roles
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/14-review-inspection-history/record.mjs
// Synthetic people and the local adapters: nothing is charged or sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-14');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 1.05));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]');
const PASSWORD = 'a-long-password';
const MECHANIC_ID = '00000000-0000-0000-0000-000000000c01';
const stamp = Date.now();
let counter = 0;

const post = (body, token, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const login = async (email, password) => (await (await fetch(`${API}/api/auth/login`, post({ email, password }))).json()).token;
async function newBuyer(address, name) {
  await fetch(`${API}/api/auth/register`, post({ fullName: name, email: address, password: PASSWORD, acceptedTerms: true }));
  const mail = await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(address)}&purpose=verify-email`)).json();
  await fetch(`${API}/api/auth/verify-email`, post({ token: mail.token }));
  return login(address, PASSWORD);
}

async function openWindow(minutes, mechanic) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const n = new Date();
    const s = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 3 + Math.floor(Math.random() * 25), 12 + Math.floor(Math.random() * 10), Math.random() < 0.5 ? 0 : 30, 0));
    const r = await fetch(`${API}/api/availability`, post({ start: s.toISOString(), end: new Date(s.getTime() + minutes * 60e3).toISOString() }, mechanic));
    if (r.status === 201) return s;
  }
  throw new Error('No free window for the mechanic');
}

/** Books one car for a buyer, through the real API. */
async function bookCar(token, name, slot, car, n) {
  const vin = `2HGFC2F59GH${String((stamp + ++counter * 7919 + n) % 1_000_000).padStart(6, '0')}`;
  const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin, odometerKm: car.km, askingPrice: car.asking, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
  const hold = await (await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC_ID, start: slot.toISOString() }, token))).json();
  const checkout = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `k-${vin}-${n}`, vehicleId: vehicle.id }, token))).json();
  const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: name, postalCode: 'L8P 1A1' }, token))).json();
  await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
  const inspection = await (await fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id }, token))).json();
  return { id: inspection.id, vin, ...car };
}

/** A buyer with a completed, a cancelled, an upcoming and a call-done car: the four kinds of row. */
async function historyBuyer() {
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  const start = await openWindow(150, mechanic);
  const email = `bea.${stamp}@example.test`;
  const token = await newBuyer(email, 'Bea Buyer');
  const specs = [
    { km: 171900, asking: 7400, kind: 'done' },
    { km: 150200, asking: 5200, kind: 'cancelled' },
    { km: 142300, asking: 8900, kind: 'upcoming' },
    { km: 118450, asking: 9600, kind: 'pending' },
  ];
  const cars = [];
  for (const [n, spec] of specs.entries()) {
    const car = await bookCar(token, 'Bea Buyer', new Date(start.getTime() + n * 30 * 60e3), spec, n);
    if (spec.kind === 'done' || spec.kind === 'pending') {
      await fetch(`${API}/api/calls/${car.id}/join`, { method: 'POST', ...authed(token) });
      await fetch(`${API}/api/calls/${car.id}/end`, { method: 'POST', ...authed(token) });
    }
    if (spec.kind === 'done') await fetch(`${API}/api/inspections/${car.id}/report`, post({ findings: [{ title: 'Brakes and tires', status: 'Required', minCents: 62000, maxCents: 90000 }] }, mechanic, 'PUT'));
    if (spec.kind === 'cancelled') await fetch(`${API}/api/inspections/${car.id}/cancel`, post({ reason: 'DifferentCar' }, token));
    cars.push(car);
  }
  return { email, token, cars };
}

/** A buyer with many cancelled inspections, made by booking and cancelling one slot again and again. */
async function longBuyer(count) {
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  const start = await openWindow(30, mechanic);
  const email = `lena.${stamp}@example.test`;
  const token = await newBuyer(email, 'Lena Longlist');
  for (let n = 0; n < count; n++) {
    const car = await bookCar(token, 'Lena Longlist', start, { km: 60000 + n * 500, asking: 4000 + n * 50 }, n);
    await fetch(`${API}/api/inspections/${car.id}/cancel`, post({ reason: 'Other' }, token));
  }
  return { email, token };
}

const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr)}`);
};
const webmIn = (dir) => join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
const toMp4 = (dir, name) => ffmpeg('-i', webmIn(dir), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`));

async function recordPage(browser, name, body) {
  const dir = join(cache, name);
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE } });
  const page = await context.newPage();
  try {
    await body(page);
  } finally {
    await context.close();
  }
  toMp4(dir, name);
}

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-14/start.log');
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
  const browser = await chromium.launch();
  const signIn = async (page, address, landing = /\/inspections$/) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(600);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(landing);
  };

  const bea = await historyBuyer();
  const [done, cancelled, upcoming, pending] = bea.cars;
  const lena = await longBuyer(45);
  const nia = { email: `nia.${stamp}@example.test` };
  await newBuyer(nia.email, 'Nia Newcomer');
  const row = (page, vin) => page.getByRole('listitem').filter({ has: page.getByRole('link', { name: vin }) });

  // ---- Scene 1: Active and Past, and what a row opens ----
  await recordPage(browser, 'history', async (page) => {
    await signIn(page, bea.email);
    await page.getByRole('tab', { name: /^Active/ }).waitFor();
    await row(page, upcoming.vin).waitFor();
    await sleep(6500);
    await page.getByRole('tab', { name: /^Past/ }).click();
    await row(page, done.vin).getByText('Report ready').waitFor();
    await sleep(6500);
    await page.getByRole('link', { name: done.vin }).click();
    await page.getByRole('heading', { name: 'Your report' }).waitFor();
    await page.getByRole('region', { name: 'Estimate summary' }).waitFor();
    await sleep(5000);
    await page.goBack();
    await page.getByRole('tab', { name: /^Past/ }).waitFor();
    await row(page, cancelled.vin).waitFor();
    await sleep(3500);
    await page.getByRole('link', { name: cancelled.vin }).click();
    await page.getByText(/^Cancelled · refunded /).waitFor();
    await sleep(6000);
  });

  // ---- Scene 2: a long history ----
  await recordPage(browser, 'long', async (page) => {
    await signIn(page, lena.email);
    await page.getByRole('tab', { name: /^Past/ }).click();
    await page.getByRole('navigation', { name: 'Pagination' }).waitFor();
    await sleep(7500);
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next' }).click();
    await page.getByText('Showing 21–40 of 45').waitFor();
    await sleep(4000);
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Next' }).click();
    await page.getByText('Showing 41–45 of 45').waitFor();
    await sleep(5000);
    await page.getByRole('navigation', { name: 'Pagination' }).getByRole('button', { name: 'Previous' }).click();
    await page.getByText('Showing 21–40 of 45').waitFor();
    await sleep(3000);
  });

  // ---- Scene 3: no inspections, a failed load, a busy list ----
  await recordPage(browser, 'states', async (page) => {
    await signIn(page, nia.email);
    await page.getByRole('heading', { name: 'No inspections yet' }).waitFor();
    await sleep(6000);
    await page.getByRole('link', { name: 'View sample report' }).click();
    await page.getByRole('heading', { name: 'Sample report' }).waitFor();
    await sleep(7000);
    await page.evaluate(() => localStorage.clear());
    await signIn(page, bea.email);
    await page.getByRole('tab', { name: /^Active/ }).waitFor();
    let failed = false;
    await page.route(/\/api\/inspections\/history/, async (route) => {
      if (!failed) {
        failed = true;
        await route.abort();
      } else {
        await new Promise((r) => setTimeout(r, 2500));
        await route.continue();
      }
    });
    await page.reload();
    await page.getByRole('alert').filter({ hasText: 'Your inspections didn’t load' }).waitFor();
    await sleep(6000);
    await page.getByRole('button', { name: 'Try again' }).click();
    await page.getByText('Loading your inspections', { exact: true }).waitFor();
    await sleep(1800);
    await row(page, upcoming.vin).waitFor();
    await sleep(3500);
  });

  // ---- Scene 4: the rules, against the real API ----
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
  const apiDir = join(cache, 'api');
  const apiBrowser = await chromium.launch();
  const apiContext = await apiBrowser.newContext({ viewport: SIZE, recordVideo: { dir: apiDir, size: SIZE } });
  const page = await apiContext.newPage();
  await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
  const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
  const run = async (label, path, token) => {
    await say(`GET /api/inspections/history${path}   ${label}`, 'cmd');
    await sleep(600);
    return fetch(`${API}/api/inspections/history${path}`, token ? authed(token) : {});
  };
  const show = async (r, text, cls) => {
    await say(`${r.status} ${text}`, cls);
    await sleep(1400);
  };
  await sleep(700);
  const a = await run('Bea', '?tab=Active', bea.token);
  const ab = await a.json();
  await show(a, `OK: ${ab.items.length} rows · ${ab.activeCount} active, ${ab.pastCount} past`, 'ok');
  const p = await run('Bea', '?tab=Past', bea.token);
  const pb = await p.json();
  await show(p, `OK: ${pb.items.map((i) => i.phase).join(', ')}`, 'ok');
  const long = await run('Lena, who has 45 past', '?tab=Past&page=2', lena.token);
  const lb = await long.json();
  await show(long, `OK: page ${lb.page}, ${lb.items.length} of ${lb.total}, ${lb.pageSize} per page`, 'ok');
  const beyond = await run('Lena, past the end', '?tab=Past&page=9', lena.token);
  await show(beyond, `OK: ${(await beyond.json()).items.length} rows`, 'ok');
  const other = await run('a different buyer', '?tab=Active', nia.token ?? (await login(nia.email, PASSWORD)));
  await show(other, `OK: ${(await other.json()).total} rows, none of Bea’s`, 'ok');
  await show(await run('an unknown tab', '?tab=Archived', bea.token), 'Bad request: use Active or Past', 'note');
  await show(await run('the mechanic', '?tab=Active', mechanicToken), 'Forbidden: the history is the buyer’s', 'note');
  await show(await run('no token', '?tab=Active', null), 'Unauthorized', 'note');
  await sleep(1500);
  await apiContext.close();
  await apiBrowser.close();
  toMp4(apiDir, 'api');
  await browser.close();
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

// Records the J13 implementation demo from the real, locally running stack:
//   clips/compare.mp4  the buyer's cars lined up lowest all-in first, one car still pending, and the lowest car's report
//   clips/phone.mp4    the same page on a phone-sized screen: the cars stack and nothing scrolls sideways
//   clips/api.mp4      real API calls: the comparison, another buyer's, the report totals, and the refused roles
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/13-compare-vehicle-estimates/record.mjs
// Synthetic people and the local adapters: nothing is charged or sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-13');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844 };
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

/** One buyer with several cars booked in one window, through the real API; each car's call is ended and its estimate sent as asked. */
async function buyerWithCars(name, tag, cars) {
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  let start = null;
  for (let attempt = 0; attempt < 120 && !start; attempt++) {
    const n = new Date();
    const s = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 3 + Math.floor(Math.random() * 25), 12 + Math.floor(Math.random() * 10), Math.random() < 0.5 ? 0 : 30, 0));
    const r = await fetch(`${API}/api/availability`, post({ start: s.toISOString(), end: new Date(s.getTime() + 30 * 60e3 * (cars.length + 1)).toISOString() }, mechanic));
    if (r.status === 201) start = s;
  }
  if (!start) throw new Error('No free window for the mechanic');
  const email = `${tag}.${stamp}@example.test`;
  const token = await newBuyer(email, name);
  const booked = [];
  for (const [n, car] of cars.entries()) {
    const slot = new Date(start.getTime() + n * 30 * 60e3).toISOString();
    const vin = `2HGFC2F59GH${String((stamp + ++counter * 7919) % 1_000_000).padStart(6, '0')}`;
    const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin, odometerKm: car.km, askingPrice: car.asking, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
    const hold = await (await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC_ID, start: slot }, token))).json();
    const checkout = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `k-${vin}`, vehicleId: vehicle.id }, token))).json();
    const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: name, postalCode: 'L8P 1A1' }, token))).json();
    await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
    const inspection = await (await fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id }, token))).json();
    await fetch(`${API}/api/calls/${inspection.id}/join`, { method: 'POST', ...authed(token) });
    await fetch(`${API}/api/calls/${inspection.id}/end`, { method: 'POST', ...authed(token) });
    if (car.cost) {
      await fetch(`${API}/api/inspections/${inspection.id}/report`, post({ findings: [{ title: 'Brakes and tires', status: 'Required', minCents: car.cost[0] * 100, maxCents: car.cost[1] * 100 }] }, mechanic, 'PUT'));
    }
    booked.push({ id: inspection.id, vin, ...car });
  }
  return { email, token, cars: booked };
}

const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr)}`);
};
const webmIn = (dir) => join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
const toMp4 = (dir, name, vf) => ffmpeg('-i', webmIn(dir), ...(vf ? ['-vf', vf] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`));

async function recordPage(browser, name, body, size = SIZE, vf) {
  const dir = join(cache, name);
  const context = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
  const page = await context.newPage();
  try {
    await body(page);
  } finally {
    await context.close();
  }
  toMp4(dir, name, vf);
}

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-13/start.log');
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
  const signIn = async (page, address, password, landing) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await sleep(600);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(landing);
  };

  // Bea has four cars in one window; three have an estimate and the fourth is still being written.
  const bea = await buyerWithCars('Bea Buyer', 'bea', [
    { km: 171900, asking: 7400, cost: [620, 900] },
    { km: 118450, asking: 9600, cost: [310, 480] },
    { km: 142300, asking: 8900, cost: [1180, 1540] },
    { km: 98000, asking: 6800, cost: null },
  ]);
  const cy = await buyerWithCars('Cy Checker', 'cy', [
    { km: 120000, asking: 5000, cost: [100, 200] },
    { km: 130000, asking: 5200, cost: [150, 250] },
  ]);
  const lowest = bea.cars[0]; // asking $7,400 plus $620 to $900 is the cheapest all-in

  // ---- Scene 1: the comparison, and the lowest car's report ----
  await recordPage(browser, 'compare', async (page) => {
    await signIn(page, bea.email, PASSWORD, /\/inspections$/);
    await sleep(2200);
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Compare' }).click();
    await page.getByRole('heading', { name: 'Compare cars' }).waitFor();
    await page.getByRole('list', { name: 'Cars' }).waitFor();
    await sleep(9000);
    await page.getByRole('listitem').filter({ hasText: bea.cars[3].vin }).scrollIntoViewIfNeeded();
    await sleep(5000);
    await page.getByRole('listitem').filter({ hasText: lowest.vin }).getByRole('link', { name: 'View report' }).click();
    await page.getByRole('heading', { name: 'Your report' }).waitFor();
    await page.getByRole('region', { name: 'Estimate summary' }).waitFor();
    await sleep(6000);
  });

  // ---- Scene 2: the same page on a phone ----
  await recordPage(browser, 'phone', async (page) => {
    await signIn(page, bea.email, PASSWORD, /\/inspections$/);
    await page.goto(`${APP}/compare`);
    await page.getByRole('list', { name: 'Cars' }).waitFor();
    await sleep(3500);
    for (let y = 0; y <= 1600; y += 200) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
      await sleep(900);
    }
    await sleep(2000);
  }, PHONE, 'scale=-2:1080,pad=1920:1080:(ow-iw)/2:0:color=0x0d1015');

  // ---- Scene 3: the rules, against the real API ----
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
  const apiDir = join(cache, 'api');
  const apiBrowser = await chromium.launch();
  const apiContext = await apiBrowser.newContext({ viewport: SIZE, recordVideo: { dir: apiDir, size: SIZE } });
  const page = await apiContext.newPage();
  await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
  const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
  const run = async (label, token) => {
    await say(`GET /api/comparisons   ${label}`, 'cmd');
    await sleep(600);
    return fetch(`${API}/api/comparisons`, token ? authed(token) : {});
  };
  const show = async (r, text, cls) => {
    await say(`${r.status} ${text}`, cls);
    await sleep(1500);
  };
  await sleep(700);
  const mine = await run('the buyer with four cars', bea.token);
  const body = await mine.json();
  await show(mine, `OK: ${body.columns.length} cars, ${body.readyCount} with an estimate`, 'ok');
  for (const c of body.columns) await say(`  ${c.status === 'Ready' ? `$${c.allInMinCents / 100}–$${c.allInMaxCents / 100}` : 'estimate not ready yet'}${c.lowest ? '   ← lowest all-in' : ''}`, 'note');
  await sleep(2200);
  const theirs = await run('a different buyer, with two cars of their own', cy.token);
  const theirBody = await theirs.json();
  await show(theirs, `OK: ${theirBody.columns.length} cars, none of them Bea’s`, 'ok');
  const none = await run('a buyer with no inspections', await newBuyer(`nia.${stamp}@example.test`, 'Nia Newcomer'));
  await show(none, 'OK: 0 cars, no window', 'ok');
  await show(await run('the mechanic', mechanicToken), 'Forbidden: comparing is the buyer’s', 'note');
  await show(await run('no token', null), 'Unauthorized', 'note');
  const report = await fetch(`${API}/api/inspections/${lowest.id}/report`, authed(bea.token));
  const reportBody = await report.json();
  const column = body.columns.find((c) => c.inspectionId === lowest.id);
  await say('GET /api/inspections/{lowest car}/report   its own report', 'cmd');
  await sleep(600);
  await show(report, `OK: all-in $${reportBody.allInMinCents / 100}–$${reportBody.allInMaxCents / 100}, the same as its column ($${column.allInMinCents / 100}–$${column.allInMaxCents / 100})`, 'ok');
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

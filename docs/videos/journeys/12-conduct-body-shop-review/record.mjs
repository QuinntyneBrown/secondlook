// Records the J12 implementation demo from the real, locally running stack:
//   clips/queue.mp4    the body shop signs in, opens its assigned reviews and joins a call
//   clips/review.mp4   the body shop writes its findings after the call and submits them
//   clips/report.mp4   the buyer reads the report: the mechanic's estimate and the body shop's findings, then a shop-only review
//   clips/api.mp4      real API calls: before the call, other roles, an unassigned shop, invalid findings, the queue
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/12-conduct-body-shop-review/record.mjs
// Synthetic people and the local adapters: nothing is charged or sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-12');
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
const SHOP_ID = '00000000-0000-0000-0000-000000000d01';
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

/** Opens windows for the people the review needs at one start, and returns that start. */
async function openWindows(people) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = new Date();
    const s = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 3 + Math.floor(Math.random() * 9), 15 + Math.floor(Math.random() * 7), 0, 0));
    let all = true;
    for (const who of people) {
      const token = await login(`${who}@example.test`, 'Password-123!');
      const r = await fetch(`${API}/api/availability`, post({ start: s.toISOString(), end: new Date(s.getTime() + 3600e3).toISOString() }, token));
      if (r.status !== 201) { all = false; break; }
    }
    if (all) return s.toISOString();
  }
  throw new Error('No free window found');
}

/** Books a review (Mechanic and body shop, or the body shop alone, or the mechanic alone) for a new buyer, through the real API. */
async function book(kind, name) {
  const tag = `${kind.toLowerCase()}${++counter}`;
  const start = await openWindows(kind === 'Both' ? ['mechanic', 'bodyshop'] : kind === 'BodyShop' ? ['bodyshop'] : ['mechanic']);
  const email = `${tag}.${stamp}@example.test`;
  const token = await newBuyer(email, name);
  const vin = `2HGFC2F59GH${String((stamp + counter * 7919) % 1_000_000).padStart(6, '0')}`;
  const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin, odometerKm: 90000, askingPrice: 5000, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
  const holdBody = kind === 'Both' ? { providerId: MECHANIC_ID, start, bodyShopId: SHOP_ID } : { providerId: kind === 'BodyShop' ? SHOP_ID : MECHANIC_ID, start };
  const hold = await (await fetch(`${API}/api/bookings/holds`, post(holdBody, token))).json();
  const review = kind === 'Both' ? 'Both' : kind;
  const checkout = await (await fetch(`${API}/api/checkouts`, post({ review, idempotencyKey: `k-${vin}`, vehicleId: vehicle.id }, token))).json();
  const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: name, postalCode: 'L8P 1A1' }, token))).json();
  await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
  const inspection = await (await fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, ...(hold.bodyShopHoldId ? { bodyShopHoldId: hold.bodyShopHoldId } : {}), vehicleId: vehicle.id }, token))).json();
  return { email, token, id: inspection.id, vin };
}

/** The buyer joins and ends the call, as it would have happened on the day. */
async function finishCall(b) {
  await fetch(`${API}/api/calls/${b.id}/join`, { method: 'POST', ...authed(b.token) });
  await fetch(`${API}/api/calls/${b.id}/end`, { method: 'POST', ...authed(b.token) });
}

const MECHANIC_FINDINGS = [
  { title: 'Front brake pads', note: 'Worn to 2 mm.', status: 'Required', minCents: 30000, maxCents: 45000 },
  { title: 'Rear tires', note: 'Cracking on the sidewall.', status: 'Recommended', minCents: 40000, maxCents: 60000 },
  { title: 'Steering', note: '', status: 'Passes', minCents: null, maxCents: null },
  { title: 'Lower control arm bushing', note: '', status: 'Required', minCents: 20000, maxCents: 30000 },
];
const BODY_FINDINGS = [
  { title: 'Rear quarter panel dent', note: 'Needs filler and paint.', status: 'Required', minCents: 80000, maxCents: 120000 },
  { title: 'Front bumper paint', note: '', status: 'Recommended', minCents: 30000, maxCents: 50000 },
  { title: 'Hood', note: '', status: 'Passes', minCents: null, maxCents: null },
];
const submitMechanic = async (id) => fetch(`${API}/api/inspections/${id}/report`, post({ findings: MECHANIC_FINDINGS }, await login('mechanic@example.test', 'Password-123!'), 'PUT'));
const submitShop = async (id, findings = BODY_FINDINGS) => fetch(`${API}/api/inspections/${id}/report/body-shop`, post({ findings }, await login('bodyshop@example.test', 'Password-123!'), 'PUT'));

const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr)}`);
};
const webmIn = (dir) => join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));
const toMp4 = (dir, name) => ffmpeg('-i', webmIn(dir), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`));

async function recordPage(browser, name, body, options = {}) {
  const dir = join(cache, name);
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE }, ...options });
  const page = await context.newPage();
  try {
    await body(page);
  } finally {
    await context.close();
  }
  toMp4(dir, name);
}

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-12/start.log');
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
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const signIn = async (page, address, password, landing) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await sleep(600);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(landing);
  };

  // The shop's situations, all made through the real API.
  const waiting = await book('Both', 'Wes Waiting');
  const delivered = await book('Both', 'Dee Delivered');
  await finishCall(delivered);
  await submitMechanic(delivered.id);
  await submitShop(delivered.id);
  const toWrite = await book('Both', 'Bea Buyer');
  await finishCall(toWrite);
  await submitMechanic(toWrite.id);
  const shopOnly = await book('BodyShop', 'Sol Solo');
  await finishCall(shopOnly);
  await submitShop(shopOnly.id, [BODY_FINDINGS[0]]);
  const unassigned = await book('Mechanic', 'Una Unassigned');
  await finishCall(unassigned);

  // ---- Scene 1: the queue, and joining a call ----
  await recordPage(browser, 'queue', async (page) => {
    await signIn(page, 'bodyshop@example.test', 'Password-123!', /\/availability$/);
    await sleep(2500);
    await page.getByRole('link', { name: 'Assigned reviews' }).click();
    await page.getByRole('heading', { name: 'Assigned reviews' }).waitFor();
    await page.getByRole('listitem').filter({ hasText: waiting.vin }).waitFor();
    await sleep(7000);
    await page.getByRole('listitem').filter({ hasText: waiting.vin }).getByRole('link', { name: 'Join call' }).click();
    await page.getByRole('heading', { name: 'Check your camera and mic' }).waitFor();
    await sleep(6000);
  }, { permissions: ['camera', 'microphone'] });

  // ---- Scene 2: writing the findings ----
  await recordPage(browser, 'review', async (page) => {
    await signIn(page, 'bodyshop@example.test', 'Password-123!', /\/availability$/);
    await page.goto(`${APP}/reviews`);
    await page.getByRole('listitem').filter({ hasText: toWrite.vin }).getByRole('link', { name: 'Write findings' }).waitFor();
    await sleep(2200);
    await page.getByRole('listitem').filter({ hasText: toWrite.vin }).getByRole('link', { name: 'Write findings' }).click();
    await page.getByRole('heading', { name: 'Write the body review' }).waitFor();
    await sleep(3500);
    for (const [title, note, status, lo, hi] of [
      ['Rear quarter panel dent', 'Needs filler and paint.', 'Required', '800', '1200'],
      ['Front bumper paint', '', 'Recommended', '300', '500'],
      ['Hood', '', 'Passes', '', ''],
    ]) {
      await page.getByRole('button', { name: 'Add a finding' }).click();
      const d = page.getByRole('dialog', { name: 'Add a finding' });
      await d.getByLabel('Title', { exact: true }).fill(title);
      if (note) await d.getByLabel('Note (optional)', { exact: true }).fill(note);
      await d.getByLabel('Status', { exact: true }).selectOption(status);
      if (lo) await d.getByLabel('Lowest cost ($)', { exact: true }).fill(lo);
      if (hi) await d.getByLabel('Highest cost ($)', { exact: true }).fill(hi);
      await sleep(900);
      await d.getByRole('button', { name: 'Add finding' }).click();
      await sleep(1000);
    }
    await sleep(2000);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await page.getByRole('status').filter({ hasText: 'Body review sent. The buyer can read it now.' }).waitFor();
    await sleep(3000);
    await page.goto(`${APP}/reviews`);
    await page.getByRole('listitem').filter({ hasText: toWrite.vin }).getByText('Delivered').waitFor();
    await sleep(3500);
  });

  // ---- Scene 3: the buyer's report, and a review with the shop alone ----
  await recordPage(browser, 'report', async (page) => {
    await signIn(page, toWrite.email, PASSWORD, /\/inspections$/);
    await page.goto(`${APP}/inspections/${toWrite.id}/report`);
    await page.getByRole('region', { name: 'Body shop review' }).waitFor();
    await sleep(9000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(5000);
    await page.evaluate(() => { localStorage.clear(); });
    await signIn(page, shopOnly.email, PASSWORD, /\/inspections$/);
    await page.goto(`${APP}/inspections/${shopOnly.id}/report`);
    await page.getByRole('region', { name: 'Body shop review' }).waitFor();
    await sleep(7000);
  });

  // ---- Scene 4: the rules, against the real API ----
  const shopToken = await login('bodyshop@example.test', 'Password-123!');
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
  const stranger = await newBuyer(`ida.${stamp}@example.test`, 'Ida Intruder');
  const apiDir = join(cache, 'api');
  const apiBrowser = await chromium.launch();
  const apiContext = await apiBrowser.newContext({ viewport: SIZE, recordVideo: { dir: apiDir, size: SIZE } });
  const page = await apiContext.newPage();
  await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
  const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
  const run = async (label, path, token, method = 'GET', body) => {
    await say(`${method} ${label}`, 'cmd');
    await sleep(600);
    return fetch(`${API}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  };
  const show = async (r, text, cls) => {
    await say(`${r.status} ${text}`, cls);
    await sleep(1300);
  };
  await sleep(700);
  await show(await run('body-shop   before the call has ended', `/api/inspections/${waiting.id}/report/body-shop`, shopToken, 'PUT', { findings: BODY_FINDINGS }), 'Conflict: write the body review once the call has ended', 'note');
  await show(await run('body-shop   the buyer tries to write it', `/api/inspections/${toWrite.id}/report/body-shop`, toWrite.token, 'PUT', { findings: BODY_FINDINGS }), 'Forbidden: that isn’t yours to do on this inspection', 'note');
  await show(await run('body-shop   the mechanic tries to write it', `/api/inspections/${toWrite.id}/report/body-shop`, mechanicToken, 'PUT', { findings: BODY_FINDINGS }), 'Forbidden: the body shop’s review is the body shop’s', 'note');
  await show(await run('body-shop   a shop that is not assigned', `/api/inspections/${unassigned.id}/report/body-shop`, shopToken, 'PUT', { findings: BODY_FINDINGS }), 'Not found: nothing about the inspection is revealed', 'note');
  await show(await run('body-shop   no findings at all', `/api/inspections/${toWrite.id}/report/body-shop`, shopToken, 'PUT', { findings: [] }), 'Bad request: add 1 to 30 findings', 'note');
  await show(await run('reviews/assigned   as the mechanic', '/api/reviews/assigned', mechanicToken), 'Forbidden: the queue is the body shop’s', 'note');
  await show(await run('report   a different buyer asks for the report', `/api/inspections/${toWrite.id}/report`, stranger), 'Not found', 'note');
  const queue = await run('reviews/assigned   as the body shop', '/api/reviews/assigned', shopToken);
  const rows = await queue.json();
  await show(queue, `OK: ${rows.length} reviews, all assigned to this shop; none for the mechanic-only inspection`, 'ok');
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

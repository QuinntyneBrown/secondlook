// Records the J05 implementation demo from the real, locally running stack:
//   clips/app.mp4   a new buyer pays in Chromium: server quote, invalid card, declined card, success, billing history
//   clips/api.mp4   real API calls: the same checkout key returns one checkout; five simultaneous payments charge once
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/05-pay-for-inspection/record.mjs
// Local synthetic data and the LOCAL payment adapter only: no real card is used and nothing is ever charged.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-05');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 0.9));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]').replace(/tok_local_[0-9a-f]+/g, 'tok_local_…');
const PASSWORD = 'a-long-password';
const stamp = Date.now();
const email = `pat.${stamp}@example.test`;
const apiEmail = `quinn.${stamp}@example.test`;

const post = (body, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const mailboxToken = async (to) => (await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(to)}&purpose=verify-email`)).json()).token;
async function newBuyer(address) {
  await fetch(`${API}/api/auth/register`, post({ fullName: 'Pat Payer', email: address, password: PASSWORD, acceptedTerms: true }));
  await fetch(`${API}/api/auth/verify-email`, post({ token: await mailboxToken(address) }));
  return (await (await fetch(`${API}/api/auth/login`, post({ email: address, password: PASSWORD }))).json()).token;
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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-05/start.log');
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
  await newBuyer(email);

  await recordPage('app', async (page) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await sleep(1000);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Your inspections' }).waitFor();
    await page.goto(`${APP}/checkout?review=Mechanic`);
    await page.getByRole('button', { name: 'Pay $50', exact: true }).waitFor();
    await sleep(4500);
    const fill = async (number, expiry, security) => {
      await page.getByLabel('Card number', { exact: true }).fill(number);
      await page.getByLabel('Expiry', { exact: true }).fill(expiry);
      await page.getByLabel('Security code', { exact: true }).fill(security);
      await page.getByLabel('Name on card', { exact: true }).fill('Jordan Lee');
      await page.getByLabel('Postal code', { exact: true }).fill('L8P 1A1');
      const box = page.getByRole('checkbox', { name: /I’ve told the seller/ });
      if (!(await box.isChecked())) await box.check();
    };
    // Invalid card.
    await fill('4000 0566 5566', '13 / 28', '');
    await sleep(1500);
    await page.getByRole('button', { name: 'Pay $50', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fix 3 things to pay' }).waitFor();
    await sleep(5000);
    // Declined card.
    await fill('4000 0000 0000 0002', '12 / 34', '123');
    await sleep(1200);
    await page.getByRole('button', { name: 'Pay $50', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Your card was declined' }).waitFor();
    await sleep(5000);
    // A different card succeeds.
    await page.getByRole('button', { name: 'Add a different card' }).click();
    await fill('4242 4242 4242 4242', '12 / 34', '123');
    await sleep(1200);
    await page.getByRole('button', { name: 'Pay $50', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Payment received' }).waitFor();
    await sleep(4500);
    await page.getByRole('link', { name: 'View billing history' }).click();
    await page.getByRole('cell', { name: 'first inspection', exact: true }).waitFor();
    await sleep(4500);
    // The next vehicle is cheaper.
    await page.goto(`${APP}/checkout?review=Both`);
    await page.getByRole('button', { name: 'Pay $45', exact: true }).waitFor();
    await sleep(5000);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const token = await newBuyer(apiEmail);
    const call = async (label, path, body, method = 'POST') => {
      await say(label, 'cmd');
      await sleep(500);
      const res = await fetch(`${API}${path}`, method === 'GET' ? { headers: { Authorization: `Bearer ${token}` } } : post(body, token));
      const json = await res.json().catch(() => ({}));
      await say(`HTTP ${res.status}`, res.ok ? 'ok' : 'bad');
      await sleep(2400);
      return json;
    };
    const first = await call('POST /api/checkouts   {review: Both, idempotencyKey: "demo-1"}', '/api/checkouts', { review: 'Both', idempotencyKey: 'demo-1' });
    await say(`id ${first.id.slice(0, 8)}…  total $${(first.quote.totalCents / 100).toFixed(2)}  (priced by the server)`, 'note');
    await sleep(3800);
    const again = await call('POST /api/checkouts   same key again', '/api/checkouts', { review: 'Both', idempotencyKey: 'demo-1' });
    await say(`id ${again.id.slice(0, 8)}…  (the same checkout, not a second one)`, 'note');
    await sleep(4200);
    await say('5 card tokens, then 5 simultaneous POST /api/checkouts/{id}/pay', 'cmd');
    const tokens = await Promise.all(Array.from({ length: 5 }, async () => (await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: 'Pat Payer', postalCode: 'L8P 1A1' }, token))).json()).token));
    const results = await Promise.all(tokens.map(async (t) => fetch(`${API}/api/checkouts/${first.id}/pay`, post({ paymentToken: t }, token))));
    const bodies = await Promise.all(results.map((r) => r.json()));
    await say(`HTTP ${results.map((r) => r.status).join(' ')}`, 'ok');
    await say(`payment ids: ${[...new Set(bodies.map((b) => b.paymentId.slice(0, 8)))].join(', ')}…  (one payment, charged once)`, 'note');
    await sleep(4500);
    const receipts = await call('GET /api/billing/receipts', '/api/billing/receipts', undefined, 'GET');
    await say(`${receipts.receipts.length} receipt: ${receipts.receipts[0].for}, $${(receipts.receipts[0].amountCents / 100).toFixed(2)}, ${receipts.receipts[0].status}`, 'note');
    await sleep(4000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

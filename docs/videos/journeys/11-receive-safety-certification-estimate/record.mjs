// Records the J11 implementation demo from the real, locally running stack:
//   clips/mechanic.mp4  the mechanic writes the estimate: a refused cost range, then four findings and Submit
//   clips/buyer.mp4     the buyer reads the report and totals, downloads the PDF and reports an issue
//   clips/share.mp4     buyer (left) shares the report; an anonymous friend (right) opens the link, then the link is turned off
//   clips/api.mp4       real API calls: before-the-call 409, buyer 403, invalid estimate 400, a stranger's 404, the PDF
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/11-receive-safety-certification-estimate/record.mjs
// Synthetic people, the local mail adapter and no payments beyond the local adapter: nothing is charged or sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-11');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const HALF = { width: 960, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * 1.05));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]');
const PASSWORD = 'a-long-password';
const MECHANIC_ID = '00000000-0000-0000-0000-000000000c01';
const stamp = Date.now();

const post = (body, token, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const authed = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const login = async (email, password) => (await (await fetch(`${API}/api/auth/login`, post({ email, password }))).json()).token;
async function newBuyer(address, name) {
  await fetch(`${API}/api/auth/register`, post({ fullName: name, email: address, password: PASSWORD, acceptedTerms: true }));
  const mail = await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(address)}&purpose=verify-email`)).json();
  await fetch(`${API}/api/auth/verify-email`, post({ token: mail.token }));
  return login(address, PASSWORD);
}

/** Opens a window for the mechanic and books its first slot for a new buyer, through the real API. */
async function bookInspection(name, tag) {
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  let start = '';
  for (let attempt = 0; attempt < 40 && !start; attempt++) {
    const n = new Date();
    const s = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 3 + Math.floor(Math.random() * 9), 15 + Math.floor(Math.random() * 7), 0, 0));
    const r = await fetch(`${API}/api/availability`, post({ start: s.toISOString(), end: new Date(s.getTime() + 3600e3).toISOString() }, mechanic));
    if (r.status === 201) start = s.toISOString();
  }
  if (!start) throw new Error('No free window for the mechanic');
  const email = `${tag}.${stamp}@example.test`;
  const token = await newBuyer(email, name);
  const vin = `2HGFC2F59GH${String((stamp + tag.length * 7919) % 1_000_000).padStart(6, '0')}`;
  const vehicle = await (await fetch(`${API}/api/vehicles`, post({ vin, odometerKm: 90000, askingPrice: 5000, sellerName: 'Sam Whitaker', sellerPhone: '9055550142' }, token))).json();
  const hold = await (await fetch(`${API}/api/bookings/holds`, post({ providerId: MECHANIC_ID, start }, token))).json();
  const checkout = await (await fetch(`${API}/api/checkouts`, post({ review: 'Mechanic', idempotencyKey: `k-${vin}`, vehicleId: vehicle.id }, token))).json();
  const card = await (await fetch(`${API}/api/payments/tokens`, post({ cardNumber: '4242 4242 4242 4242', expiry: '12 / 34', securityCode: '123', nameOnCard: name, postalCode: 'L8P 1A1' }, token))).json();
  await fetch(`${API}/api/checkouts/${checkout.id}/pay`, post({ paymentToken: card.token }, token));
  const inspection = await (await fetch(`${API}/api/bookings`, post({ checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id }, token))).json();
  return { email, token, id: inspection.id };
}

/** The buyer joins and ends the call, as it would have happened on the day. */
async function finishCall(booked) {
  await fetch(`${API}/api/calls/${booked.id}/join`, { method: 'POST', ...authed(booked.token) });
  await fetch(`${API}/api/calls/${booked.id}/end`, { method: 'POST', ...authed(booked.token) });
}

const FINDINGS = [
  { title: 'Front brake pads', note: 'Worn to 2 mm.', status: 'Required', minCents: 30000, maxCents: 45000 },
  { title: 'Rear tires', note: 'Cracking on the sidewall.', status: 'Recommended', minCents: 40000, maxCents: 60000 },
  { title: 'Steering', note: '', status: 'Passes', minCents: null, maxCents: null },
  { title: 'Lower control arm bushing', note: '', status: 'Required', minCents: 20000, maxCents: 30000 },
];
const submitEstimate = async (id) => {
  const mechanic = await login('mechanic@example.test', 'Password-123!');
  return fetch(`${API}/api/inspections/${id}/report`, post({ findings: FINDINGS }, mechanic, 'PUT'));
};

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
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-11/start.log');
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

  // ---- Scene 1: the mechanic writes the estimate ----
  const first = await bookInspection('Bea Buyer', 'bea');
  await finishCall(first);
  await recordPage(browser, 'mechanic', async (page) => {
    await signIn(page, 'mechanic@example.test', 'Password-123!', /\/availability$/);
    await page.goto(`${APP}/inspections/${first.id}/estimate`);
    await page.getByRole('heading', { name: 'Write the estimate' }).waitFor();
    await sleep(3500);
    const add = async (f) => {
      await page.getByRole('button', { name: 'Add a finding' }).click();
      const d = page.getByRole('dialog', { name: 'Add a finding' });
      await d.getByLabel('Title', { exact: true }).fill(f.title);
      if (f.note) await d.getByLabel('Note (optional)', { exact: true }).fill(f.note);
      await d.getByLabel('Status', { exact: true }).selectOption(f.status);
      if (f.min) await d.getByLabel('Lowest cost ($)', { exact: true }).fill(f.min);
      if (f.max) await d.getByLabel('Highest cost ($)', { exact: true }).fill(f.max);
      await sleep(1000);
      await d.getByRole('button', { name: 'Add finding' }).click();
      return d;
    };
    // A reversed range is refused in the dialog, then corrected.
    const d = await add({ title: 'Front brake pads', note: 'Worn to 2 mm.', status: 'Required', min: '450', max: '300' });
    await d.getByText('Use a cost range from zero up to $100,000, lowest first.').waitFor();
    await sleep(3200);
    await d.getByLabel('Lowest cost ($)', { exact: true }).fill('300');
    await d.getByLabel('Highest cost ($)', { exact: true }).fill('450');
    await sleep(800);
    await d.getByRole('button', { name: 'Add finding' }).click();
    await sleep(1200);
    await add({ title: 'Rear tires', note: 'Cracking on the sidewall.', status: 'Recommended', min: '400', max: '600' });
    await sleep(900);
    await add({ title: 'Steering', status: 'Passes' });
    await sleep(900);
    await add({ title: 'Lower control arm bushing', status: 'Required', min: '200', max: '300' });
    await sleep(2500);
    await page.getByRole('button', { name: 'Submit estimate' }).click();
    await page.getByRole('status').filter({ hasText: 'Estimate sent. The buyer can read it now.' }).waitFor();
    await sleep(4000);
  });

  // ---- Scene 2: the buyer reads it, downloads a copy and asks about a cost ----
  await recordPage(browser, 'buyer', async (page) => {
    await signIn(page, first.email, PASSWORD, /\/inspections$/);
    await sleep(1200);
    await page.goto(`${APP}/inspections/${first.id}`);
    await page.getByRole('link', { name: 'View report' }).waitFor();
    await sleep(1800);
    await page.getByRole('link', { name: 'View report' }).click();
    await page.getByRole('heading', { name: 'Your report' }).waitFor();
    await page.getByRole('list', { name: 'Findings' }).waitFor();
    await sleep(6000);
    await page.getByRole('button', { name: 'Download report' }).click();
    const dialog = page.getByRole('dialog', { name: 'Download the report' });
    await dialog.waitFor();
    await sleep(2800);
    const saved = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download PDF' }).click();
    await saved;
    await sleep(2000);
    await page.getByRole('button', { name: 'Report an issue' }).click();
    const issue = page.getByRole('dialog', { name: 'Report an issue' });
    await issue.waitFor();
    await sleep(1800);
    await issue.getByRole('button', { name: 'Send' }).click();
    await issue.getByText('Choose what’s wrong.').waitFor();
    await sleep(2500);
    await issue.getByRole('radio', { name: 'The cost seems off' }).check();
    await issue.getByLabel('Tell us more (optional)', { exact: true }).fill('The brake price looks high.');
    await sleep(1200);
    await issue.getByRole('button', { name: 'Send' }).click();
    await issue.getByText('Thanks. Maya will take another look.').waitFor();
    await sleep(3500);
  });

  // ---- Scene 3: sharing, with an anonymous friend's browser beside the buyer's ----
  const buyerDir = join(cache, 'share-buyer');
  const friendDir = join(cache, 'share-friend');
  const make = (dir) => browser.newContext({ viewport: HALF, recordVideo: { dir, size: HALF } });
  const buyerContext = await make(buyerDir);
  const friendContext = await make(friendDir);
  const buyer = await buyerContext.newPage();
  const friend = await friendContext.newPage();
  await friend.goto(`${APP}/sign-in`);
  await signIn(buyer, first.email, PASSWORD, /\/inspections$/);
  await buyer.goto(`${APP}/inspections/${first.id}/report`);
  await buyer.getByRole('heading', { name: 'Your report' }).waitFor();
  await sleep(1500);
  await buyer.getByRole('button', { name: 'Share', exact: true }).click();
  const share = buyer.getByRole('dialog', { name: 'Share this report' });
  await share.getByLabel('Share link', { exact: true }).waitFor();
  await sleep(1500);
  await buyer.waitForFunction(() => document.querySelector('#share-link')?.value.includes('/shared/'));
  const link = await share.getByLabel('Share link', { exact: true }).inputValue();
  await sleep(3200);
  await share.getByLabel('Send to', { exact: true }).fill('sam.whitaker@example');
  await share.getByRole('button', { name: 'Send report' }).click();
  await share.getByText('Enter a valid email address, like name@example.com.').waitFor();
  await sleep(3000);
  await share.getByLabel('Send to', { exact: true }).fill('sam.whitaker@example.com');
  await share.getByRole('button', { name: 'Send report' }).click();
  await share.getByText('Report sent to sam.whitaker@example.com').waitFor();
  await sleep(2500);
  await friend.goto(link);
  await friend.getByRole('heading', { name: 'Shared report' }).waitFor();
  await sleep(6000);
  await share.getByRole('button', { name: 'Turn off link' }).click();
  await share.getByText('The link is turned off.').waitFor();
  await sleep(1500);
  await share.getByRole('button', { name: 'Done' }).click();
  await friend.reload();
  await friend.getByRole('alert').filter({ hasText: 'This report isn’t shared with you' }).waitFor();
  await sleep(4500);
  await buyerContext.close();
  await friendContext.close();
  await browser.close();
  ffmpeg('-i', webmIn(buyerDir), '-i', webmIn(friendDir), '-filter_complex', '[0:v]scale=960:1080,setsar=1[a];[1:v]scale=960:1080,setsar=1[b];[a][b]hstack=inputs=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, 'share.mp4'));

  // ---- Scene 4: the rules, against the real API ----
  const second = await bookInspection('Cy Checker', 'cy');
  const stranger = await newBuyer(`ida.${stamp}@example.test`, 'Ida Intruder');
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
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
    await sleep(1400);
  };
  const base = `/api/inspections/${second.id}/report`;
  await sleep(700);
  await show(await run('report   mechanic writes it before the call has ended', base, mechanicToken, 'PUT', { findings: FINDINGS }), 'Conflict: write the report once the call has ended', 'note');
  await finishCall(second);
  await show(await run('report   the buyer tries to write it', base, second.token, 'PUT', { findings: FINDINGS }), 'Forbidden: only the mechanic writes the estimate', 'note');
  await show(await run('report   a reversed cost range', base, mechanicToken, 'PUT', { findings: [{ title: 'Brakes', status: 'Required', minCents: 45000, maxCents: 30000 }] }), 'Bad request: use a cost range from zero up to $100,000, lowest first', 'note');
  await show(await run('report   a valid estimate', base, mechanicToken, 'PUT', { findings: FINDINGS }), 'OK: 4 findings, 2 required', 'ok');
  await show(await run('report   a different buyer asks for it', base, stranger), 'Not found: nothing is revealed', 'note');
  await show(await run('shared-reports/not-a-real-link   no token', '/api/shared-reports/not-a-real-link', null), 'Not found: this report isn’t shared with you', 'note');
  const pdf = await run('report/pdf   the buyer who booked it', `${base}/pdf`, second.token);
  const bytes = Buffer.from(await pdf.arrayBuffer());
  await show(pdf, `OK ${pdf.headers.get('content-type')} · ${bytes.length} bytes · starts ${bytes.subarray(0, 8).toString('latin1').trim()}`, 'ok');
  await sleep(1500);
  await apiContext.close();
  await apiBrowser.close();
  toMp4(apiDir, 'api');
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

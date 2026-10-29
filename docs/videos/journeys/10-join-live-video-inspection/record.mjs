// Records the J10 implementation demo from the real, locally running stack:
//   clips/join.mp4     buyer (left) and mechanic (right) in two browser sessions: lobby, join, live video
//   clips/inspect.mp4  the mechanic moves the checklist and adds a note; the buyer sees both
//   clips/recover.mp4  a dropped connection recovers, the buyer ends the call, both see the summary
//   clips/api.mp4      real API calls: an outsider gets 404, anonymous gets 401, the buyer cannot run the checklist
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/10-join-live-video-inspection/record.mjs
// Synthetic people, Chromium's fake camera and microphone, local adapters only: nothing is charged or sent.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-10');
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

const post = (body, token) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
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

const ffmpeg = (...args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${String(r.stderr)}`);
};
const webmIn = (dir) => join(dir, readdirSync(dir).find((f) => f.endsWith('.webm')));

const startLog = openSync(join(cache, 'start.log'), 'w');
if (spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] }).status !== 0) throw new Error('API did not start; see .cache/journey-10/start.log');
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

  // ---- Scene 1-3: two real browser sessions on Chromium's synthetic camera and microphone ----
  const booked = await bookInspection('Bea Buyer', 'bea');
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const make = (dir) => browser.newContext({ viewport: HALF, permissions: ['camera', 'microphone'], recordVideo: { dir, size: HALF } });
  const buyerDir = join(cache, 'buyer');
  const mechDir = join(cache, 'mechanic');
  const t0 = Date.now();
  const buyerContext = await make(buyerDir);
  const mechContext = await make(mechDir);
  const buyer = await buyerContext.newPage();
  const mech = await mechContext.newPage();
  const marks = {};
  const mark = (name) => (marks[name] = (Date.now() - t0) / 1000);

  // So the connection can be cut the way a dropped network would.
  const sockets = [];
  await buyer.routeWebSocket(/\/api\/calls\/[^/]+\/ws/, (ws) => {
    const server = ws.connectToServer();
    sockets.push(ws);
    ws.onClose(() => void server.close());
  });
  const signIn = async (page, address, password) => {
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(address);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await sleep(700);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/(inspections|availability)$/);
  };
  const live = (page) => page.getByRole('status').filter({ hasText: /^Live/ }).waitFor();
  const seeVideo = (page, who) =>
    page.waitForFunction((name) => {
      const v = document.querySelector(`figure[aria-label="${name}"] video`);
      return v && v.videoWidth > 0;
    }, who);

  await mech.goto(`${APP}/sign-in`);
  await signIn(buyer, booked.email, PASSWORD);
  await sleep(1500);
  await buyer.goto(`${APP}/inspections/${booked.id}`);
  await buyer.getByRole('link', { name: 'Join the call' }).waitFor();
  await sleep(2500);
  await buyer.getByRole('link', { name: 'Join the call' }).click();
  await buyer.getByRole('heading', { name: 'Check your camera and mic' }).waitFor();
  await sleep(5000);
  await buyer.getByRole('button', { name: 'Join the call' }).click();
  await live(buyer);
  await sleep(2500);
  await signIn(mech, 'mechanic@example.test', 'Password-123!');
  await mech.goto(`${APP}/inspections/${booked.id}/lobby`);
  await mech.getByRole('heading', { name: 'Check your camera and mic' }).waitFor();
  await sleep(3500);
  await mech.getByRole('button', { name: 'Join the call' }).click();
  await live(mech);
  await seeVideo(buyer, 'Maya Mechanic');
  await seeVideo(mech, 'Bea Buyer');
  await sleep(6000);
  mark('joined');

  await mech.getByRole('button', { name: 'Mark done, next item' }).click();
  await sleep(2500);
  await mech.getByRole('button', { name: 'Add a note' }).click();
  const dialog = mech.getByRole('dialog', { name: 'Add a note' });
  await dialog.getByLabel('Note', { exact: true }).pressSequentially('Front brake pads look thin.', { delay: 60 });
  await sleep(800);
  await dialog.getByRole('button', { name: 'Add note' }).click();
  await buyer.getByRole('region', { name: 'Notes from Maya' }).getByText('Front brake pads look thin.').waitFor();
  await sleep(5000);
  mark('inspected');

  await Promise.all(sockets.splice(0).map((ws) => ws.close()));
  await buyer.getByRole('status').filter({ hasText: 'Reconnecting' }).waitFor();
  await sleep(2500);
  await live(buyer);
  await seeVideo(buyer, 'Maya Mechanic');
  await sleep(4000);
  await buyer.getByRole('button', { name: 'End call', exact: true }).click();
  const end = buyer.getByRole('dialog', { name: 'End the call for everyone?' });
  await end.waitFor();
  await sleep(4500);
  await end.getByRole('button', { name: 'End call', exact: true }).click();
  await buyer.getByRole('heading', { name: 'Call ended' }).waitFor();
  await mech.getByRole('heading', { name: 'Call ended' }).waitFor();
  await sleep(6000);
  mark('ended');

  await buyerContext.close();
  await mechContext.close();
  await browser.close();
  const side = join(cache, 'side-by-side.mp4');
  ffmpeg('-i', webmIn(buyerDir), '-i', webmIn(mechDir), '-filter_complex', '[0:v]scale=960:1080,setsar=1[a];[1:v]scale=960:1080,setsar=1[b];[a][b]hstack=inputs=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', side);
  const cut = (name, from, to) => ffmpeg('-i', side, '-ss', String(from), ...(to ? ['-to', String(to)] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`));
  cut('join', 0, marks.joined);
  cut('inspect', marks.joined, marks.inspected);
  cut('recover', marks.inspected, null);

  // ---- Scene 4: access control, against the real API ----
  const second = await bookInspection('Cy Checker', 'cy');
  const outsider = await newBuyer(`ida.${stamp}@example.test`, 'Ida Intruder');
  const mechanicToken = await login('mechanic@example.test', 'Password-123!');
  const apiDir = join(cache, 'api');
  const apiBrowser = await chromium.launch();
  const apiContext = await apiBrowser.newContext({ viewport: SIZE, recordVideo: { dir: apiDir, size: SIZE } });
  const page = await apiContext.newPage();
  await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
  const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
  const call = async (label, path, token, method = 'GET') => {
    await say(`${method} ${label}`, 'cmd');
    await sleep(700);
    const r = await fetch(`${API}${path}`, { method, ...(token ? authed(token) : {}) });
    return r;
  };
  const show = async (r, text, cls) => {
    await say(`${r.status} ${text}`, cls);
    await sleep(1500);
  };
  const id = second.id;
  await sleep(800);
  await show(await call('/api/calls/{inspection}   as the buyer who booked it', `/api/calls/${id}`, second.token), 'OK: the lobby, with the people on the call', 'ok');
  await show(await call('/api/calls/{inspection}   as a different buyer', `/api/calls/${id}`, outsider), 'Not found: nothing about the inspection is revealed', 'note');
  await show(await call('/api/calls/{inspection}   with no token', `/api/calls/${id}`, null), 'Unauthorized', 'note');
  await show(await call('/api/calls/{inspection}/join   as the buyer', `/api/calls/${id}/join`, second.token, 'POST'), 'OK: the call has started', 'ok');
  await show(await call('/api/calls/{inspection}/checklist/advance   as the buyer', `/api/calls/${id}/checklist/advance`, second.token, 'POST'), 'Forbidden: only the mechanic runs the checklist', 'note');
  await show(await call('/api/calls/{inspection}/checklist/advance   as the mechanic', `/api/calls/${id}/checklist/advance`, mechanicToken, 'POST'), 'OK: Brakes done, Tires now', 'ok');
  await show(await call('/api/calls/{inspection}/end   as the buyer', `/api/calls/${id}/end`, second.token, 'POST'), 'OK: the call has ended', 'ok');
  await show(await call('/api/calls/{inspection}/end   again', `/api/calls/${id}/end`, second.token, 'POST'), 'OK: same answer; ending twice changes nothing', 'ok');
  await sleep(1800);
  await apiContext.close();
  await apiBrowser.close();
  ffmpeg('-i', webmIn(apiDir), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, 'api.mp4'));
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

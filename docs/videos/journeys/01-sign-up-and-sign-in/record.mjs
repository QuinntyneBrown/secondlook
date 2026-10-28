// Records the J01 implementation demo from the real, locally running stack:
//   clips/app.mp4   the buyer app in Chromium: invalid sign-up, sign-up, verify, rejected and real sign-in, reset, sign-out
//   clips/api.mp4   real API calls: provider registers unapproved, admin cannot be self-registered
// Usage (repo root; solution built; PowerShell 7, Node 22, ffmpeg):  node docs/videos/journeys/01-sign-up-and-sign-in/record.mjs
// Local synthetic data only; the mail adapter is the in-memory local mailbox, so no email is sent. Stops only its own processes.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-01');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });
copyFileSync(join(here, '..', '00-initial-setup-and-platform', 'terminal.html'), join(cache, 'terminal.html'));

const API = 'http://localhost:5100';
const APP = 'http://localhost:4200';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]');
const stamp = Date.now();
const email = `jordan.${stamp}@example.test`;
const provider = `shop.${stamp}@example.test`;
const PASSWORD = 'a-long-password';

function toMp4(videoDir, name) {
  const webm = readdirSync(videoDir).find((f) => f.endsWith('.webm'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(videoDir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', join(clips, `${name}.mp4`)]);
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

async function mailboxToken(page, to, purpose) {
  const r = await page.request.get(`${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(to)}&purpose=${purpose}`);
  return (await r.json()).token;
}

// Start the API (migrate + seed + run) and the buyer app, each hidden and owned by this script.
const startLog = openSync(join(cache, 'start.log'), 'w');
const started = spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1'], { cwd: root, stdio: ['ignore', startLog, startLog] });
if (started.status !== 0) throw new Error('API did not start; see .cache/journey-01/start.log');
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

  await recordPage('app', async (page) => {
    const type = async (label, value) => {
      await page.getByLabel(label, { exact: true }).click();
      await page.getByLabel(label, { exact: true }).pressSequentially(value, { delay: 45 });
    };
    // Sign-up with invalid input.
    await page.goto(`${APP}/sign-up`);
    await sleep(2500);
    await type('Email', 'jordan.lee@');
    await type('Password', 'short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('alert').filter({ hasText: 'Fix 3 things to continue' }).waitFor();
    await sleep(4500);
    // Valid sign-up.
    await page.getByLabel('Full name', { exact: true }).fill('Jordan Lee');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('checkbox', { name: /I agree/ }).check();
    await sleep(1500);
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('heading', { name: 'Check your email' }).waitFor();
    await sleep(4000);
    // Signing in before verifying is refused.
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('alert').filter({ hasText: 'Verify your email to sign in' }).waitFor();
    await sleep(3500);
    // Open the emailed link.
    await page.goto(`${APP}/verify-email?token=${encodeURIComponent(await mailboxToken(page, email, 'verify-email'))}`);
    await page.getByRole('heading', { name: 'You’re verified' }).waitFor();
    await sleep(4000);
    // Wrong password, then the right one.
    await page.goto(`${APP}/sign-in`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('alert').filter({ hasText: 'That email and password don’t match' }).waitFor();
    await sleep(4000);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByRole('heading', { name: 'Your inspections' }).waitFor();
    await sleep(3000);
    // Sign out through the dialog.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('dialog').waitFor();
    await sleep(4000);
    await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    await sleep(3000);
    // Forgotten password: request, choose a new one.
    await page.goto(`${APP}/forgot-password`);
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await page.getByRole('status').filter({ hasText: 'Check your email' }).waitFor();
    await sleep(3500);
    await page.goto(`${APP}/reset-password?token=${encodeURIComponent(await mailboxToken(page, email, 'reset-password'))}`);
    await page.getByLabel('New password', { exact: true }).fill('brand-new-password');
    await page.getByLabel('Confirm new password', { exact: true }).fill('brand-new-password');
    await sleep(1500);
    await page.getByRole('button', { name: 'Save password' }).click();
    await page.getByRole('status').filter({ hasText: 'Password updated' }).waitFor();
    await sleep(4500);
  });

  await recordPage('api', async (page) => {
    await page.goto(pathToFileURL(join(cache, 'terminal.html')).href);
    const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
    const post = async (label, path, body) => {
      await say(label, 'cmd');
      await sleep(700);
      const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const text = (await res.text()).slice(0, 150);
      await say(`HTTP ${res.status}`, res.ok ? 'ok' : 'bad');
      if (text) await say(text, 'out');
      await sleep(3800);
      return text;
    };
    await post('POST /api/auth/register   role: BodyShop', '/api/auth/register', { fullName: 'Bo Bodyshop', email: provider, password: PASSWORD, acceptedTerms: true, role: 'BodyShop' });
    const token = (await (await fetch(`${API}/api/platform/diagnostics/mailbox?email=${provider}&purpose=verify-email`)).json()).token;
    await post('POST /api/auth/verify-email', '/api/auth/verify-email', { token });
    await post('POST /api/auth/login   (the shop)', '/api/auth/login', { email: provider, password: PASSWORD });
    await post('POST /api/auth/register   role: Admin', '/api/auth/register', { fullName: 'Mallory', email: `admin.${stamp}@example.test`, password: PASSWORD, acceptedTerms: true, role: 'Admin' });
    await sleep(5000);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
  spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
}
console.log('Clips written to', clips);

// Records the J00 implementation demo from the real, locally running stack:
//   clips/setup.mp4     real `secondlook migrate/seed` + API start-up, output captured live
//   clips/access.mp4    real HTTP calls against the API: 401, 200, 403, 500 problem+json
//   clips/app.mp4       the real buyer shell in Chromium: ready, 404, API down -> 500, recovery
// Usage (repo root, PowerShell 7 + Node 22 + ffmpeg):  node docs/videos/journeys/00-initial-setup-and-platform/record.mjs
// Everything is local and synthetic; tokens are redacted on screen. It stops only the processes it starts.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const clips = join(here, 'clips');
const cache = join(root, '.cache', 'journey-00');
const { chromium } = createRequire(join(root, 'e2e', 'package.json'))('@playwright/test');
mkdirSync(clips, { recursive: true });
rmSync(cache, { recursive: true, force: true });
mkdirSync(cache, { recursive: true });

const API = 'http://localhost:5100';
const SIZE = { width: 1920, height: 1080 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const redact = (s) => s.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, 'eyJ…[redacted]');

function toMp4(videoDir, name) {
  const webm = readdirSync(videoDir).find((f) => f.endsWith('.webm'));
  const out = join(clips, `${name}.mp4`);
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(videoDir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', out]);
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

async function terminal(page) {
  await page.goto(pathToFileURL(join(here, 'terminal.html')).href);
  const say = (text, cls = 'out') => page.evaluate(([t, c]) => window.addLine(t, c), [redact(text), cls]);
  return {
    say,
    async run(label, file, args, env = {}) {
      await say(label, 'cmd');
      await sleep(700);
      const log = join(cache, `cmd-${Date.now()}.log`);
      const fd = openSync(log, 'w');
      const r = spawnSync(file, args, { cwd: root, stdio: ['ignore', fd, fd], env: { ...process.env, ...env } });
      for (const line of readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).slice(-6)) {
        await say(line, r.status === 0 ? 'ok' : 'bad');
        await sleep(900);
      }
      await sleep(4000);
      return r.status;
    },
  };
}

const jwtEnv = {
  SecondLook__Jwt__Issuer: 'secondlook',
  SecondLook__Jwt__Audience: 'secondlook-api',
  SecondLook__Jwt__SigningKey: 'e2e-only-signing-key-not-a-secret-0123456789abcdef',
};
const db = 'Data Source=.run/e2e/secondlook-e2e.db';
const cli = ['run', '--project', 'backend/src/SecondLook.Cli', '--no-build', '--'];

// Scene 1: explicit migrate, repeated seed, API start.
await recordPage('setup', async (page) => {
  const t = await terminal(page);
  await t.say('# Clean checkout: restored, nothing running. Storage is a disposable SQLite file.', 'note');
  await t.run('pwsh eng/Start-E2eApi.ps1', 'pwsh', ['-NoProfile', '-File', 'eng/Start-E2eApi.ps1']);
  await t.run('secondlook seed   # run again: nothing is duplicated', 'dotnet', [...cli, 'seed', '--provider', 'Sqlite', '--connection', db]);
  await t.run('secondlook seed   # on a file that was never migrated: refused', 'dotnet', [...cli, 'seed', '--provider', 'Sqlite', '--connection', 'Data Source=.run/e2e/never-migrated.db']);
});

// Scene 2: authentication, roles and errors against the real API.
function token(email) {
  const r = spawnSync('dotnet', [...cli, 'token', '--email', email, '--provider', 'Sqlite', '--connection', db], { cwd: root, encoding: 'utf8', env: { ...process.env, ...jwtEnv } });
  return r.stdout.trim();
}
await recordPage('access', async (page) => {
  const t = await terminal(page);
  const call = async (label, path, bearer) => {
    await t.say(label, 'cmd');
    await sleep(600);
    const res = await fetch(`${API}${path}`, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} });
    const text = (await res.text()).slice(0, 160);
    await t.say(`HTTP ${res.status}  ${res.headers.get('content-type') ?? ''}`, res.ok ? 'ok' : 'bad');
    if (text) await t.say(text, 'out');
    await sleep(3800);
  };
  await call('GET /health/ready            (anonymous)', '/health/ready');
  await call('GET /api/platform/me         (no token)', '/api/platform/me');
  const buyer = token('buyer@example.test');
  await t.say('secondlook token --email buyer@example.test   ->  ' + buyer, 'note');
  await call('GET /api/platform/me         (buyer token)', '/api/platform/me', buyer);
  await call('GET /api/platform/access/admin   (buyer token)', '/api/platform/access/admin', buyer);
  const admin = token('admin@example.test');
  await call('GET /api/platform/diagnostics/fault   (admin token)', '/api/platform/diagnostics/fault', admin);
  await sleep(5000);
});

// Scene 3: the real buyer shell.
const ng = spawn('npm', ['run', 'start', '--', '--port', '4200'], { cwd: join(root, 'frontend'), shell: true, stdio: 'ignore', windowsHide: true });
try {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch('http://localhost:4200')).ok) break;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  await recordPage('app', async (page) => {
    const ready = page.getByRole('status').filter({ hasText: 'The API is ready' });
    await page.goto('http://localhost:4200/');
    await ready.waitFor();
    await sleep(4500);
    await page.goto('http://localhost:4200/no/such/page');
    await page.getByRole('heading', { name: 'We can’t find that page' }).waitFor();
    await sleep(4500);
    await page.route('**/health/ready', (route) => route.abort('connectionrefused'));
    await page.goto('http://localhost:4200/');
    await page.getByRole('heading', { name: 'That one’s on us' }).waitFor();
    await sleep(4500);
    await page.unroute('**/health/ready');
    await page.getByRole('button', { name: 'Try again' }).click();
    await ready.waitFor();
    await sleep(4500);
  });
} finally {
  spawnSync('taskkill', ['/PID', String(ng.pid), '/T', '/F'], { stdio: 'ignore' });
}
spawnSync('pwsh', ['-NoProfile', '-File', 'eng/Stop-E2eApi.ps1'], { cwd: root, stdio: 'inherit' });
console.log('Clips written to', clips);

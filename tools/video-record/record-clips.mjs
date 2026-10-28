#!/usr/bin/env node
// Screen recorder for docs/videos/NN-topic/clips/: drives the real app with Playwright and
// writes one MP4 per clip, for slides.html to play inside a slide (`data-clip`).
//
//   node tools/video-record/record-clips.mjs docs/videos/12-x              record every clip
//   node tools/video-record/record-clips.mjs docs/videos/12-x name,name    record only these
//
// The folder's clips/clips.mjs exports:
//   config  { baseURL, viewport: { width, height } }   viewport = the clip size in pixels
//   clips   { name: async (t) => { ... } }             recorded in declaration order
//   setup   optional { name: async (t) => { ... } }    runs before that clip, off camera
//   viewports  optional { name: { width, height } }    a clip recorded at another size
//
// Each clip gets a fresh browser context. `t` is the toolkit below: `t.page`, `t.click(loc)`,
// `t.type(loc, text)`, `t.go(path)`, `t.hover(loc)`, `t.scroll(px)`, `t.wait(ms)`, `t.signIn(email)`. A drawn
// cursor follows the mouse, because the screencast does not include the system one.
//
// Frames come from the Chrome DevTools screencast (crisper than Playwright's own video), and
// each one is held until the next arrives, so the MP4 runs in real time at 30 fps.
// SL_DEMO_RESET, when set, is a shell command run once before recording (restore demo data).
// Needs Playwright from e2e/node_modules and ffmpeg (FFMPEG_PATH override).
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const { chromium } = createRequire(join(repo, 'e2e', 'package.json'))('@playwright/test');

const CURSOR = `
(() => {
  if (window.__sdCursor) return;
  window.__sdCursor = true;
  const install = () => {
    const c = document.createElement('div');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);transition:none';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.7 15 L18.5 15 Z" fill="#1f2937" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const ring = document.createElement('div');
    ring.style.cssText = 'position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;z-index:2147483646;pointer-events:none;background:rgba(224,120,86,.35);opacity:0;transform:scale(.4);transition:opacity .35s, transform .35s';
    document.documentElement.append(ring, c);
    addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', (e) => {
      ring.style.transition = 'none'; ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
      ring.style.opacity = '1'; ring.style.transform = 'scale(.4)';
      requestAnimationFrame(() => { ring.style.transition = 'opacity .45s, transform .45s'; ring.style.opacity = '0'; ring.style.transform = 'scale(1.3)'; });
    }, true);
  };
  if (document.documentElement) install(); else addEventListener('DOMContentLoaded', install);
})();`;

/** The scripted-viewer toolkit a clip function receives. */
function toolkit(page, config) {
  let pos = { x: config.viewport.width * 0.6, y: config.viewport.height * 0.55 };
  const wait = (ms) => page.waitForTimeout(ms);
  async function moveTo(locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    if (!box) throw new Error(`no box for ${locator}`);
    const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const steps = Math.max(12, Math.round(Math.hypot(to.x - pos.x, to.y - pos.y) / 18));
    await page.mouse.move(to.x, to.y, { steps });
    pos = to;
  }
  return {
    page,
    wait,
    moveTo,
    /** Opens a path of the app under test and waits for it to settle. */
    async go(path) {
      await page.goto(new URL(path, config.baseURL).href);
      await page.waitForLoadState('networkidle');
    },
    async hover(locator, ms = 600) {
      await moveTo(locator);
      await wait(ms);
    },
    async click(locator, ms = 350) {
      await moveTo(locator);
      await wait(ms);
      await page.mouse.down();
      await page.mouse.up();
    },
    async type(locator, text, delay = 55) {
      await moveTo(locator);
      await wait(250);
      await locator.click();
      await locator.pressSequentially(text, { delay });
    },
    /** Smooth wheel scroll by `px` (negative scrolls up). */
    async scroll(px, ms = 900) {
      const steps = Math.max(8, Math.round(ms / 30));
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, px / steps);
        await wait(ms / steps);
      }
    },
    /** API sign-in seeded into storage, so a clip can open signed in without the form. */
    async signIn(email, password = 'password123') {
      const res = await page.request.post(`${config.apiURL}/api/auth/login`, { data: { email, password } });
      if (!res.ok()) throw new Error(`login ${email}: ${res.status()}`);
      const { token } = await res.json();
      // The SessionStore's persisted shape (as e2e/fixtures/auth.ts seeds it).
      await page.addInitScript((payload) => {
        if (sessionStorage.getItem('sd.demo.seeded') === payload.value) return;
        localStorage.setItem('sd.auth.token', JSON.stringify(payload));
        localStorage.setItem('sd.auth.storage', 'local');
        sessionStorage.setItem('sd.demo.seeded', payload.value);
      }, { value: token.accessToken, expiresUtc: token.accessTokenExpiresAtUtc, refreshToken: token.refreshToken });
    },
  };
}

async function recordClip(browser, config, name, fn, setup, outFile, work) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const t = toolkit(page, config);
  if (setup) await setup(t);

  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  const { width, height } = config.viewport;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  // Nudge a repaint so the first frame exists even on a still page.
  await page.mouse.move(t.page.viewportSize().width * 0.6, t.page.viewportSize().height * 0.55);
  await page.waitForTimeout(400);
  await fn(t);
  await page.waitForTimeout(600);
  const stop = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await context.close();
  if (frames.length === 0) throw new Error(`${name}: no frames captured`);

  const dir = join(work, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const lines = [];
  let total = 0;
  frames.forEach((f, i) => {
    const file = join(dir, `${String(i).padStart(5, '0')}.jpg`);
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(stop, f.t + 0.5);
    const duration = Math.max(0.001, next - f.t);
    total += duration;
    lines.push(`file '${file.replace(/\\/g, '/')}'`, `duration ${duration.toFixed(4)}`);
  });
  lines.push(lines.at(-2)); // concat demuxer: repeat the last frame so its duration counts...
  writeFileSync(join(dir, 'frames.txt'), lines.join('\n'));
  execFileSync(ffmpeg, [
    '-y', '-v', 'error',
    '-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'),
    '-t', total.toFixed(3), // ...and cut the repeat's own duration off again
    '-vf', `scale=${width}:${height}:flags=lanczos,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart',
    outFile,
  ], { stdio: 'inherit' });
  const seconds = frames.at(-1).t - frames[0].t;
  console.log(`  ${name}: ${frames.length} frames, ${seconds.toFixed(1)} s → ${basename(outFile)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const folder = resolve(args.find((a) => !a.startsWith('--')) ?? '');
  const only = args.filter((a) => !a.startsWith('--'))[1]?.split(',');
  const module = join(folder, 'clips', 'clips.mjs');
  if (!existsSync(module)) throw new Error(`${module} missing`);
  const { config, clips, setup = {}, viewports = {} } = await import(pathToFileURL(module).href);
  const work = join(repo, '.cache', basename(folder), 'recordings');
  mkdirSync(work, { recursive: true });

  if (process.env.SL_DEMO_RESET) {
    console.log(`reset: ${process.env.SL_DEMO_RESET}`);
    execSync(process.env.SL_DEMO_RESET, { stdio: 'inherit' });
  }
  const browser = await chromium.launch();
  try {
    for (const [name, fn] of Object.entries(clips)) {
      if (only && !only.includes(name)) continue;
      const clipConfig = { ...config, viewport: viewports[name] ?? config.viewport };
      await recordClip(browser, clipConfig, name, fn, setup[name], join(folder, 'clips', `${name}.mp4`), work);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

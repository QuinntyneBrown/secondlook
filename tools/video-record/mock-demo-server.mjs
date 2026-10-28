#!/usr/bin/env node
// THROWAWAY demo server: serves docs/mocks/ so the demo videos can be recorded before the app
// exists. Not used by the app or by any test.
//
//   node tools/video-record/mock-demo-server.mjs [port]     default 4310
//
// The mocks are static pages, one per state, and most of their buttons do nothing. This server
// injects a small script into each page that (a) hides the mock bar, (b) makes the pressed-state
// buttons (day and time chips) behave like a radio group, and (c) sends the journey's primary
// buttons to the next mock, so a recording can click straight through a flow.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/mocks');
const port = Number(process.argv[2] ?? 4310);

// page path → { button text: next page path }.
const FLOW = {
  '/pages/book-vehicle/default.html': { 'Continue to review type': '/pages/book-review-type/default.html' },
  '/pages/book-review-type/default.html': { 'Continue to scheduling': '/pages/book-schedule/default.html' },
  '/pages/book-schedule/default.html': { 'Continue to payment': '/pages/checkout/default.html' },
  '/pages/checkout/default.html': { 'Pay $45': '/pages/checkout/submitting.html' },
  '/dialogs/end-call/default.html': { 'End call': '/pages/live-inspection/ended.html' },
};

// A transient state forwards itself to the page that follows it, after a beat.
const FORWARD = { '/pages/checkout/submitting.html': { after: 1400, to: '/pages/booking-confirmed/default.html' } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

const inject = (path) => `<script>
(() => {
  const flow = ${JSON.stringify(FLOW[path] ?? {})};
  document.documentElement.dataset.chrome = 'off';
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    if (button.getAttribute('aria-pressed') !== null && !button.hasAttribute('data-theme-toggle') && !button.hasAttribute('data-chrome-toggle')) {
      button.parentElement.querySelectorAll('button[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    }
    const next = flow[button.textContent.trim()];
    if (next) location.href = next;
  });
  ${FORWARD[path] ? `setTimeout(() => { location.href = ${JSON.stringify(FORWARD[path].to)}; }, ${FORWARD[path].after});` : ''}
})();
</script>`;

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  let file = normalize(join(root, decodeURIComponent(pathname)));
  if (!file.startsWith(root)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return void res.writeHead(404).end('not found');
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  if (extname(file) !== '.html') {
    res.writeHead(200, { 'content-type': type });
    return void createReadStream(file).pipe(res);
  }
  const html = readFileSync(file, 'utf8').replace('</body>', `${inject(pathname)}</body>`);
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(html);
}).listen(port, () => console.log(`mock demo server on http://localhost:${port}/ (serving ${root})`));

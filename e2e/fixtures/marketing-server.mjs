#!/usr/bin/env node
// Serves the static marketing site (marketing/, ADR-018) the way its Static Web
// App does: the `globalHeaders` and `routes` redirects from
// marketing/staticwebapp.config.json, `index.html` for a folder, and a plain
// 404 for anything else (no SPA fallback). Tests therefore load the page under
// the production Content-Security-Policy (L2-154).
//
//   node fixtures/marketing-server.mjs <root> <port>    (from e2e/)
//   node fixtures/marketing-server.mjs ../marketing 4500
//
// Dependency-free on purpose: the site has no build and no package.json.
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "../marketing");
const port = Number(process.argv[3] ?? 4500);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
};

function config() {
  try {
    return JSON.parse(readFileSync(resolve(root, "staticwebapp.config.json"), "utf8"));
  } catch {
    return {};
  }
}

createServer((req, res) => {
  const { globalHeaders = {}, routes = [] } = config();
  const send = (status, headers, body) => {
    res.writeHead(status, { ...globalHeaders, "Cache-Control": "no-store", ...headers });
    res.end(body);
  };
  let path;
  try {
    path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    return send(400, { "Content-Type": "text/plain" }, "bad request");
  }
  const redirect = routes.find((r) => r.redirect && r.route === path);
  if (redirect) return send(redirect.statusCode ?? 302, { Location: redirect.redirect }, "");

  let file = resolve(root, "." + path);
  if (file !== root && !file.startsWith(root + sep)) return send(404, { "Content-Type": "text/plain" }, "not found");
  try {
    if (statSync(file).isDirectory()) file = resolve(file, "index.html");
    const stat = statSync(file);
    const type = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      // Media elements ask for byte ranges; answer them so <video> can seek.
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : stat.size - 1;
      res.writeHead(206, {
        ...globalHeaders,
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      return req.method === "HEAD" ? res.end() : createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      ...globalHeaders,
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    return req.method === "HEAD" ? res.end() : createReadStream(file).pipe(res);
  } catch {
    return send(404, { "Content-Type": "text/plain" }, "not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`marketing site on http://localhost:${port} from ${root}`));

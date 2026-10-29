// Build the business-plan video: one picture-led scene per narrated paragraph, shared voice and music.
// Captions are omitted; scene changes follow the narration's measured paragraph starts.
import { chromium } from "../../../e2e/node_modules/playwright-core/index.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "../../..");
const name = "05-secondlook-business-plan";
const cache = join(root, ".cache", name);
const manifest = JSON.parse(readFileSync(join(cache, "manifest.json"), "utf8"));
if (manifest.voice !== "en-US-AndrewMultilingualNeural")
  throw Error("Voice must match existing videos");
const blocks = manifest.sections.flatMap((s) => s.blocks);
const scenes = blocks.length;
const TAIL = 3; // seconds of music after the last word
const duration = Math.ceil((manifest.duration + TAIL) * 10) / 10;

mkdirSync(cache, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  for (let i = 1; i <= scenes; i++) {
    await page.goto(
      pathToFileURL(join(folder, "slides.html")).href + `?slide=${i}`,
    );
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.locator("section.active").evaluate((s) =>
      [...s.querySelectorAll("h1,h2,p,svg")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > 1920 || r.bottom > 1080 || r.left < 0 || r.top < 0);
        })
        .map((e) => e.tagName + ":" + (e.textContent ?? "").slice(0, 30)),
    );
    if (issues.length) throw Error(`Slide ${i} overflow: ${issues.join(", ")}`);
    await page.screenshot({ path: join(cache, `slide-${i}.png`) });
  }
} finally {
  await browser.close();
}

// Each scene begins with its paragraph; the first begins at zero and the last runs through the music tail.
const starts = blocks.map((b, i) => (i === 0 ? 0 : b.start - 0.15));
const durations = starts.map((t, i) => (starts[i + 1] ?? duration) - t);
writeFileSync(
  join(cache, "schedule.json"),
  JSON.stringify({ duration, voice: manifest.voice, captions: false, starts, durations }, null, 2),
);
writeFileSync(
  join(cache, "slides.txt"),
  durations
    .flatMap((d, i) => [`file 'slide-${i + 1}.png'`, `duration ${d.toFixed(6)}`])
    .concat(`file 'slide-${scenes}.png'`)
    .join("\n"),
);

const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const fadeOutAt = (duration - 2.5).toFixed(2);
execFileSync(
  ffmpeg,
  [
    "-y", "-v", "error",
    "-f", "concat", "-safe", "0", "-i", join(cache, "slides.txt"),
    "-i", join(folder, `${name}.mp3`),
    "-stream_loop", "-1",
    "-i", join(root, "docs/videos/assets/music/on-the-beach-intro-outro.mp3"),
    "-filter_complex",
    `[1:a]loudnorm=I=-18.3:TP=-1.5:LRA=11,apad,atrim=duration=${duration}[voice];` +
      `[2:a]atrim=duration=${duration},asetpts=PTS-STARTPTS,volume=-11.43dB,afade=t=in:d=1.5,afade=t=out:st=${fadeOutAt}:d=2.5[music];` +
      `[voice][music]amix=inputs=2:duration=first:normalize=0[mix]`,
    "-map", "0:v", "-map", "[mix]",
    "-t", String(duration), "-r", "30",
    "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    join(folder, `${name}.mp4`),
  ],
  { stdio: "inherit" },
);
// A poster from the opening scene.
execFileSync(ffmpeg, ["-y", "-v", "error", "-i", join(cache, "slide-1.png"), join(folder, "poster.png")]);
console.log(`Built ${duration}s 1080p video; captions off.`);

// Rebuild the 30-second pitch with the shared slide renderer, voice and music.
// Captions are omitted; timing follows the narration's measured paragraph starts.
import { chromium } from "../../../e2e/node_modules/playwright-core/index.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "../../..");
const cache = join(root, ".cache/04-secondlook-pitch");
const manifest = JSON.parse(readFileSync(join(cache, "manifest.json"), "utf8"));
if (manifest.voice !== "en-US-AndrewMultilingualNeural")
  throw Error("Voice must match existing videos");
if (manifest.duration > 28.5)
  throw Error("Narration must leave room for the closing music");
const blocks = manifest.sections.flatMap((s) => s.blocks);
if (blocks.length !== 4) throw Error("Expected four narrated scenes");
mkdirSync(cache, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  // Capture the same static product reference used by the existing videos.
  const shots = [
    ["live-inspection", "live-inspection"],
    ["report", "safety-estimate"],
    ["compare", "compare"],
  ];
  mkdirSync(join(folder, "screenshots"), { recursive: true });
  const capture = await browser.newPage({
    viewport: { width: 1408, height: 792 },
    deviceScaleFactor: 1,
  });
  for (const [screen, name] of shots) {
    await capture.goto(
      pathToFileURL(join(root, `docs/mocks/pages/${screen}/default.html`)).href,
    );
    await capture.evaluate(() => document.fonts.ready);
    await capture.addStyleTag({
      content: ".mock-note, .mock-bar { display: none !important; }",
    });
    await capture.screenshot({ path: join(folder, `screenshots/${name}.png`) });
  }
  await capture.close();
  for (let i = 0; i < 5; i++) {
    await page.goto(
      pathToFileURL(join(folder, "slides.html")).href +
        `?slide=${i + 1}&render=1`,
    );
    await page.evaluate(() => document.fonts.ready);
    const issues = await page.locator("section.active").evaluate((s) =>
      [...s.querySelectorAll("h1,h2,h3,p,.card,img")]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.right > 1920 || r.bottom > 1080 || r.left < 0 || r.top < 0;
        })
        .map((e) => e.textContent),
    );
    if (issues.length)
      throw Error(`Slide ${i + 1} overflow: ${issues.join(", ")}`);
    await page.screenshot({ path: join(cache, `slide-${i + 1}.png`) });
  }
} finally {
  await browser.close();
}
// The estimate scene starts at the second sentence of paragraph two.
const review = blocks[1];
const words = review.text.split(/\s+/);
const estimateWord = words.findIndex((w) => w === "Find");
if (estimateWord < 0) throw Error("Estimate cue missing");
const estimateStart =
  review.start + ((review.end - review.start) * estimateWord) / words.length;
const starts = [
  blocks[0].start,
  review.start,
  estimateStart,
  blocks[2].start,
  blocks[3].start,
];
starts[0] = 0;
const durations = starts.map((t, i) => (starts[i + 1] ?? 30) - t);
writeFileSync(
  join(cache, "schedule.json"),
  JSON.stringify(
    { duration: 30, voice: manifest.voice, captions: false, starts, durations },
    null,
    2,
  ),
);
writeFileSync(
  join(cache, "slides.txt"),
  durations
    .flatMap((d, i) => [
      `file 'slide-${i + 1}.png'`,
      `duration ${d.toFixed(6)}`,
    ])
    .concat("file 'slide-5.png'")
    .join("\n"),
);
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
execFileSync(
  ffmpeg,
  [
    "-y",
    "-v",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    join(cache, "slides.txt"),
    "-i",
    join(folder, "04-secondlook-pitch.mp3"),
    "-stream_loop",
    "-1",
    "-i",
    join(root, "docs/videos/assets/music/on-the-beach-intro-outro.mp3"),
    "-filter_complex",
    "[1:a]loudnorm=I=-18.3:TP=-1.5:LRA=11,apad,atrim=duration=30[voice];[2:a]atrim=duration=30,asetpts=PTS-STARTPTS,volume=-11.43dB,afade=t=in:d=1.5,afade=t=out:st=28:d=2[music];[voice][music]amix=inputs=2:duration=first:normalize=0[mix]",
    "-map",
    "0:v",
    "-map",
    "[mix]",
    "-t",
    "30",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    join(folder, "04-secondlook-pitch.mp4"),
  ],
  { stdio: "inherit" },
);
console.log("Built 30-second 1080p pitch; captions off.");

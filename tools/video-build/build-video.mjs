#!/usr/bin/env node
// Video builder for docs/videos/NN-topic/: slides.html + the narration manifest → captioned MP4.
//
//   node tools/video-build/build-video.mjs docs/videos/01-x --check         resolve cues, print the schedule
//   node tools/video-build/build-video.mjs docs/videos/01-x --slides-only   render PNGs to .cache/01-x/slides/
//   node tools/video-build/build-video.mjs docs/videos/01-x                 encode the 1920x1080 MP4
//
// A slide with data-clip="clips/x.mp4" (a screen recording from tools/video-record) gets that
// MP4 overlaid on its .clip box for the slide's time: held on its last frame when the narration
// runs longer, sped up evenly when it runs shorter. data-clip-delay="s" holds the first frame.
//
// --music <file> (opt-in, e.g. the brand video) mixes a track under the narration the way
// Shelfie's brand video does: narration brought to MUSIC_VOICE_LUFS, the track looped
// MUSIC_GAIN dB below its own level with no ducking,
// faded in and out, and the last slide held MUSIC_TAIL seconds so the music plays out alone.
// Without it the audio is the narration MP3 as before.
//
// Needs the manifest written by tools/video-audio (run it first), Chrome/Chromium (EDGE_PATH
// or CHROME_PATH override; Playwright's bundled Chromium is found automatically) and ffmpeg
// with libx264 and libass (FFMPEG_PATH override).
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const MAX_CLIP_RATE = 1.6;
const MIN_SLIDE = 4;
const MAX_SLIDE = 90;
// Measured from Shelfie's meet-shelfie.mp4 (see docs/videos/README.md, "Background music").
const MUSIC_GAIN = -11.43;
const MUSIC_FADE_IN = 1.5;
const MUSIC_FADE_OUT = 2;
const MUSIC_TAIL = 3;
const MUSIC_VOICE_LUFS = -18.3; // Shelfie's narration loudness, so the mix lands at its -18.6

function findBrowser() {
  const override = process.env.EDGE_PATH ?? process.env.CHROME_PATH;
  if (override) return override;
  const candidates = [
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  // Playwright's browsers: prefer headless_shell, whose viewport is exactly --window-size
  // (new-headless Chrome reserves window chrome and leaves a strip under the page).
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH ?? "/opt/pw-browsers";
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((d) =>
      /^chromium_headless_shell-\d+$/.test(d),
    )) {
      candidates.unshift(join(pw, d, "chrome-linux", "headless_shell"));
    }
    for (const d of readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d))) {
      candidates.push(join(pw, d, "chrome-linux", "chrome"));
    }
  }
  const found = candidates.find((c) => existsSync(c));
  if (!found)
    throw new Error("No Chrome/Edge found; set EDGE_PATH or CHROME_PATH");
  return found;
}

const norm = (s) =>
  s
    .replace(/`/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** <section> attributes in document order (the slides are hand-authored, so a regex suffices). */
function parseSlides(html) {
  return [...html.matchAll(/<section\b([^>]*)>/g)].map((m, i) => {
    const attr = (name) => m[1].match(new RegExp(`${name}="([^"]*)"`))?.[1];
    return {
      index: i,
      id: attr("id") ?? `slide-${i + 1}`,
      cue: attr("data-cue"),
      part: Number(attr("data-part") ?? 0),
      clip: attr("data-clip"),
      clipDelay: Number(attr("data-clip-delay") ?? 0),
    };
  });
}

/** data-cue → seconds: a `##` heading is its section's start; text inside a paragraph is
 *  interpolated by words. Every cue must be unique in the script. */
function resolveCues(slides, manifest) {
  const errors = [];
  let last = -1;
  for (const s of slides) {
    if (s.index === 0) {
      s.start = 0;
      continue;
    }
    if (!s.cue) {
      errors.push(`slide ${s.index + 1} (#${s.id}) has no data-cue`);
      continue;
    }
    const cue = norm(s.cue);
    const hits = [];
    for (const sec of manifest.sections) {
      if (norm(sec.title) === cue)
        hits.push({ t: sec.start, where: `## ${sec.title}` });
      for (const b of sec.blocks) {
        const text = norm(b.text);
        let at = text.indexOf(cue);
        while (at !== -1) {
          const before = text.slice(0, at).split(" ").filter(Boolean).length;
          const total = text.split(" ").length;
          hits.push({
            t: b.start + ((b.end - b.start) * before) / total,
            where: text.slice(0, 50),
          });
          at = text.indexOf(cue, at + 1);
        }
      }
    }
    if (hits.length === 0)
      errors.push(
        `slide ${s.index + 1} (#${s.id}): cue not found in script: "${s.cue}"`,
      );
    else if (hits.length > 1)
      errors.push(
        `slide ${s.index + 1} (#${s.id}): cue is not unique (${hits.length} matches): "${s.cue}"`,
      );
    else {
      s.start = Math.max(0, hits[0].t - 0.15);
      if (s.start <= last)
        errors.push(
          `slide ${s.index + 1} (#${s.id}): cue is out of narration order`,
        );
      last = s.start;
    }
  }
  slides.forEach(
    (s, i) =>
      (s.end = i + 1 < slides.length ? slides[i + 1].start : manifest.duration),
  );
  return errors;
}

const ts = (t) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2).padStart(5, "0");
  return `${h}:${String(m).padStart(2, "0")}:${s}`;
};
const mmss = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Paragraph → caption lines of at most ~84 characters, timed by character share. */
function captionEvents(manifest) {
  const events = [];
  for (const sec of manifest.sections) {
    for (const b of sec.blocks) {
      // A sentence ends at . ! or ? followed by a space, so "www.secondlook.ca" and
      // `SecondLook.Api` stay whole.
      const sentences = b.caption.split(/(?<=[.!?]["')\]]?)\s+/);
      const chunks = [];
      for (let s of sentences.map((x) => x.trim()).filter(Boolean)) {
        while (s.length > 84) {
          let cut = s.lastIndexOf(" ", 84);
          const comma = s.lastIndexOf(", ", 84);
          if (comma > 40) cut = comma + 1;
          chunks.push(s.slice(0, cut).trim());
          s = s.slice(cut).trim();
        }
        chunks.push(s);
      }
      const total = chunks.reduce((n, c) => n + c.length, 0);
      let t = b.start;
      for (const c of chunks) {
        const d = ((b.end - b.start) * c.length) / total;
        events.push({
          start: t,
          end: t + d,
          text: (b.speaker ? `${b.speaker}: ` : "") + c,
        });
        t += d;
      }
    }
  }
  return events;
}

function writeAss(events, file) {
  const esc = (s) =>
    s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,40,&H00FFFFFF,&H00FFFFFF,&H50291F1F,&H50291F1F,0,0,0,0,100,100,0,0,3,14,0,2,160,160,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  writeFileSync(
    file,
    header +
      events
        .map(
          (e) =>
            `Dialogue: 0,${ts(e.start)},${ts(e.end)},Default,,0,0,0,,${esc(e.text)}`,
        )
        .join("\n") +
      "\n",
  );
}

function writeSrt(events, file) {
  const t = (x) =>
    ts(x)
      .replace(/^(\d):/, "0$1:")
      .replace(".", ",") + "0";
  writeFileSync(
    file,
    events
      .map((e, i) => `${i + 1}\n${t(e.start)} --> ${t(e.end)}\n${e.text}\n`)
      .join("\n"),
  );
}

/** Lays out every slide at 1920x1080 in one headless pass; returns overflow problems and clip boxes. */
function auditSlides(slidesFile) {
  const browser = findBrowser();
  const dom = execFileSync(
    browser,
    [
      ...(basename(browser) === "headless_shell" ? [] : ["--headless=new"]),
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1920,1080",
      "--virtual-time-budget=3000",
      "--dump-dom",
      `${pathToFileURL(slidesFile).href}?render=1&audit=1`,
    ],
    { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  ).toString();
  const read = (name) => {
    const m = dom.match(new RegExp(`${name}="([^"]*)"`));
    return (
      m &&
      JSON.parse(
        m[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">"),
      )
    );
  };
  const problems = read("data-audit");
  if (!problems)
    throw new Error("slide audit did not run (no data-audit on <body>)");
  return { problems, clips: read("data-clips") ?? [] };
}

function renderSlides(slidesFile, slides, outDir) {
  const browser = findBrowser();
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const url = pathToFileURL(slidesFile).href;
  for (const s of slides) {
    const png = join(outDir, `${String(s.index + 1).padStart(3, "0")}.png`);
    execFileSync(
      browser,
      [
        ...(basename(browser) === "headless_shell" ? [] : ["--headless=new"]),
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=1920,1080",
        "--virtual-time-budget=2000",
        `--screenshot=${png}`,
        `${url}?render=1&slide=${s.index + 1}`,
      ],
      { stdio: "ignore" },
    );
    if (!existsSync(png))
      throw new Error(`screenshot failed for slide ${s.index + 1}`);
    s.png = png;
    process.stdout.write(".");
  }
  process.stdout.write("\n");
}

/** EBU R128 integrated loudness of a file, in LUFS. */
function integratedLoudness(file) {
  const r = spawnSync(
    ffmpeg,
    ["-hide_banner", "-i", file, "-af", "ebur128", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const m = r.stderr.match(/Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS/);
  if (!m) throw new Error(`could not measure the loudness of ${file}`);
  return Number(m[1]);
}

function main() {
  const args = process.argv.slice(2);
  const folder = resolve(
    args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--music") ?? "",
  );
  const name = basename(folder);
  const cache = join(repo, ".cache", name);
  const manifestFile = join(cache, "manifest.json");
  if (!existsSync(manifestFile))
    throw new Error(`${manifestFile} missing — run tools/video-audio first`);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  const slidesFile = join(folder, "slides.html");
  const slides = parseSlides(readFileSync(slidesFile, "utf8"));

  const errors = resolveCues(slides, manifest);
  if (errors.length) throw new Error(errors.join("\n"));
  const musicArg = args[args.indexOf("--music") + 1];
  const music = args.includes("--music") ? resolve(musicArg ?? "") : null;
  if (music && (!musicArg || !existsSync(music)))
    throw new Error(`--music: ${musicArg ?? "(no file)"} not found`);
  const duration = manifest.duration + (music ? MUSIC_TAIL : 0);
  slides.at(-1).end = duration;
  const warnings = [];
  console.log(
    `${manifest.title} — ${slides.length} slides, ${mmss(duration)}${music ? ` (${MUSIC_TAIL} s music-only tail)` : ""}`,
  );
  for (const s of slides) {
    const d = s.end - s.start;
    const flag =
      d < MIN_SLIDE ? "  << short" : d > MAX_SLIDE ? "  >> long" : "";
    if (flag)
      warnings.push(`slide ${s.index + 1} (#${s.id}) is ${d.toFixed(1)} s`);
    console.log(
      `  ${String(s.index + 1).padStart(2)}  ${mmss(s.start)}  ${d.toFixed(1).padStart(5)} s  #${s.id}${flag}`,
    );
  }
  const audit = auditSlides(slidesFile);
  for (const p of audit.problems) {
    warnings.push(
      `slide ${p.slide} (#${p.id}): ${p.issue} ${JSON.stringify(p.el ?? "")} ${JSON.stringify(p.bottom ?? p.over ?? p.height)}`,
    );
  }
  for (const s of slides.filter((x) => x.clip)) {
    s.clipFile = resolve(folder, s.clip);
    s.box = audit.clips.find((c) => c.slide === s.index + 1);
    if (!existsSync(s.clipFile))
      throw new Error(
        `slide ${s.index + 1} (#${s.id}): ${s.clip} not found — run tools/video-record`,
      );
    if (!s.box)
      throw new Error(`slide ${s.index + 1} (#${s.id}): no .clip box measured`);
    const length = Number(
      execFileSync(ffprobe, [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        s.clipFile,
      ]).toString(),
    );
    const room = s.end - s.start - s.clipDelay;
    s.rate = length > room ? length / room : 1;
    s.pad = Math.max(0, room - length / s.rate) + 1;
    const fit =
      s.rate > 1
        ? `x${s.rate.toFixed(2)} speed`
        : `holds its last frame ${(room - length).toFixed(1)} s`;
    console.log(
      `  clip #${s.id}: ${length.toFixed(1)} s in ${room.toFixed(1)} s, ${fit}`,
    );
    if (s.rate > MAX_CLIP_RATE)
      warnings.push(
        `slide ${s.index + 1} (#${s.id}) plays its clip at x${s.rate.toFixed(2)}; give it more narration`,
      );
  }
  if (warnings.length) console.warn(`warnings:\n  ${warnings.join("\n  ")}`);
  if (args.includes("--check")) return;

  renderSlides(slidesFile, slides, join(cache, "slides"));
  console.log(`rendered ${slides.length} PNGs to .cache/${name}/slides/`);
  if (args.includes("--slides-only")) return;

  const events = captionEvents(manifest);
  const ass = join(cache, "captions.ass");
  writeAss(events, ass);
  writeSrt(events, join(cache, "captions.srt"));

  const list = join(cache, "slides.txt");
  const lines = slides.flatMap((s) => [
    `file '${s.png}'`,
    `duration ${(s.end - s.start).toFixed(3)}`,
  ]);
  lines.push(`file '${slides.at(-1).png}'`); // concat demuxer: repeat the last frame
  writeFileSync(list, lines.join("\n"));
  const mp3 = join(folder, `${name}.mp3`);
  const mp4 = join(folder, `${name}.mp4`);
  // Two passes, because the concat demuxer yields one frame per slide. Expanding a
  // 60-second slide to 30 fps inside the filter graph (fps=30,ass=...) queues ~1,800
  // uncompressed 1080p frames ahead of the caption renderer and gets ffmpeg killed for
  // memory. Pass 1 duplicates frames at the encoder (bounded), pass 2 burns captions
  // while streaming that constant-frame-rate video.
  const stills = join(cache, "slides.mp4");
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
      list,
      "-r",
      "30",
      "-fps_mode",
      "cfr",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-tune",
      "stillimage",
      "-crf",
      "12",
      "-pix_fmt",
      "yuv420p",
      stills,
    ],
    { stdio: "inherit" },
  );
  // Recordings are overlaid in this pass, each delayed to its slide's start, so the stills
  // stay a constant-frame-rate stream and only the clip slides carry motion.
  const clips = slides.filter((s) => s.clip);
  const graph = [];
  let last = "0:v";
  clips.forEach((s, i) => {
    const { x, y, w, h } = s.box;
    graph.push(
      `[${i + 2}:v]setpts=(PTS-STARTPTS)/${s.rate.toFixed(4)},scale=${w}:${h},` +
        `tpad=start_mode=clone:start_duration=${s.clipDelay}:stop_mode=clone:stop_duration=${s.pad.toFixed(3)},` +
        `setpts=PTS+${s.start.toFixed(3)}/TB[c${i}]`,
      `[${last}][c${i}]overlay=${x}:${y}:enable='between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})'[v${i}]`,
    );
    last = `v${i}`;
  });
  // Relative to cwd: an absolute Windows path (C:\…) breaks the filter's option parsing.
  graph.push(`[${last}]ass=${basename(ass)},format=yuv420p[out]`);
  // The music loops from the start at a fixed gain (no ducking) and ends with the video; the
  // narration is padded with silence to the same length, so the tail is music alone.
  if (music) {
    const m = clips.length + 2;
    const end = duration.toFixed(3);
    const voiceGain = MUSIC_VOICE_LUFS - integratedLoudness(mp3);
    graph.push(
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${voiceGain.toFixed(2)}dB,apad=whole_dur=${end}[voice]`,
      `[${m}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${MUSIC_GAIN}dB,atrim=0:${end},` +
        `afade=t=in:d=${MUSIC_FADE_IN},afade=t=out:st=${(duration - MUSIC_FADE_OUT).toFixed(3)}:d=${MUSIC_FADE_OUT}[music]`,
      `[voice][music]amix=inputs=2:duration=first:normalize=0[mix]`,
    );
  }
  execFileSync(
    ffmpeg,
    [
      "-y",
      "-v",
      "error",
      "-i",
      stills,
      "-i",
      mp3,
      ...clips.flatMap((s) => ["-i", s.clipFile]),
      ...(music ? ["-stream_loop", "-1", "-i", music] : []),
      "-filter_complex",
      graph.join(";"),
      "-map",
      "[out]",
      "-map",
      music ? "[mix]" : "1:a",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      ...(clips.length
        ? ["-crf", "22"]
        : ["-tune", "stillimage", "-crf", "26"]),
      "-c:a",
      "aac",
      "-b:a",
      music ? "128k" : "96k",
      "-movflags",
      "+faststart",
      "-shortest",
      mp4,
    ],
    { stdio: "inherit", cwd: cache },
  );
  console.log(`wrote ${mp4}`);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

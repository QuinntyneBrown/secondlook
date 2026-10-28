# 04 · A second look before you buy

**Runtime:** 30 seconds · **Audience:** used-car buyers · **Captions:** off by default

[Watch the pitch](04-secondlook-pitch.mp4) · [Narration](04-secondlook-pitch.mp3) · [Transcript](script.md) · [Slides](slides.html)

A short pitch explaining why an as-is buyer would get a SecondLook before committing to a vehicle.

## Run sheet

| Time            | Scene                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| 00:00–00:05     | The asking price is only part of the story                               |
| 00:05–00:15.5   | A local mechanic over live video; optional body shop review              |
| 00:15.5–00:22.4 | Vehicle comparison screenshot; first inspection $50, additional cars $25 |
| 00:22.4–00:30   | Know the cost before you commit; closing music                           |

## Styling and sound

Uses the existing `../assets/slides.css`, its imported mock tokens, `../assets/slides.js`, and `../assets/mark.svg` without changes. Uses the shared promo layout with no tutorial header or progress bar.

Narrator: Edge TTS `en-US-AndrewMultilingualNeural`, the same voice recorded in the existing videos' generation manifests, at its default rate. The 27.2-second narration plays at its original speed.

Music: the existing `../assets/music/on-the-beach-intro-outro.mp3`, starting at the beginning. The mix follows the existing builder: narration at -18.3 LUFS, music gain -11.43 dB, 1.5-second fade-in and 2-second fade-out. Music continues to exactly 30 seconds. See the [music provenance](../assets/music/README.md).

No captions are burned in or embedded. Slide headlines are intentional visual content, not a transcript overlay.

## Rebuild

From the repository root, with frontend/e2e dependencies, Python `edge-tts`, FFmpeg and Playwright Chromium installed:

```powershell
$env:PYTHON = 'python'
$env:EDGE_VOICE = 'en-US-AndrewMultilingualNeural'
node tools/video-audio/generate-audio.mjs docs/videos/04-secondlook-pitch --dry-run
node tools/video-audio/generate-audio.mjs docs/videos/04-secondlook-pitch
node tools/video-build/build-video.mjs docs/videos/04-secondlook-pitch --check
node docs/videos/04-secondlook-pitch/build.mjs
```

`build.mjs` is the caption-free, fixed-duration render path for this pitch. It checks the voice, measures narration timing, renders the shared slides, checks for overflow and mixes the existing track. It does not change the shared tutorial builder. Temporary renders and timing data go under `.cache/04-secondlook-pitch/`.

Verified output: 30.000 seconds, 1920×1080, 30 fps, H.264 video and AAC audio, with no subtitle stream. All five rendered scenes reviewed, including three product screenshots.

## Product screenshots

The build captures three desktop screens directly from the static mocks at 1408×792: live inspection, safety estimate report, and vehicle comparison. PNGs are saved in screenshots/ and incorporated into the encoded video. Mock-only navigation and notes are hidden. The pitch.css file arranges the screenshots beside scene headlines using the shared palette, typography and image framing.

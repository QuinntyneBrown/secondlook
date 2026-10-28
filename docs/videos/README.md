# Videos

Narrated walkthroughs made with the `creating-videos` skill (`.claude/skills/creating-videos/SKILL.md`). Each folder holds the text the video is built from (`script.md`, `slides.html`, `README.md`), the screen recordings it plays (`clips/`) and the generated `NN-topic.mp3` and `NN-topic.mp4`.

The recordings come from the static mocks in `docs/mocks/`, played through a throwaway server, so they show the designed flow rather than the built app.

| # | Video | Runtime | Journey |
|---|---|---|---|
| 01 | [Booking an inspection](01-booking-an-inspection/README.md) | 2:17 | Book a video inspection |
| 02 | [The live inspection](02-the-live-inspection/README.md) | 2:14 | Join live video inspection |
| 03 | [Your safety estimate](03-your-safety-estimate/README.md) | 2:21 | Receive safety certification estimate |

### Implementation demos

Recorded from the running application, API and CLI (not from the static mocks), one per journey, under `journeys/`.

| # | Demo | Runtime | Journey |
|---|---|---|---|
| J00 | [Initial setup and platform](journeys/00-initial-setup-and-platform/README.md) | 2:12 | Initial setup and platform |

## Making or updating a video

Run from the repository root. Generated timing, slide renders and recordings go to `.cache/` (ignored by git).

```sh
# 1. The mocks, with their buttons wired into flows (leave running)
node tools/video-record/mock-demo-server.mjs            # http://localhost:4310

# 2. Screen recordings
node tools/video-record/record-clips.mjs docs/videos/NN-topic [clip,clip]

# 3. Narration: script.md → NN-topic.mp3 and .cache/NN-topic/manifest.json
python -m pip install edge-tts                          # free Edge read-aloud, needs internet
node tools/video-audio/generate-audio.mjs docs/videos/NN-topic --dry-run
node tools/video-audio/generate-audio.mjs docs/videos/NN-topic

# 4. Video: check cues, look at the slides, then encode
node tools/video-build/build-video.mjs docs/videos/NN-topic --check
node tools/video-build/build-video.mjs docs/videos/NN-topic --slides-only
node tools/video-build/build-video.mjs docs/videos/NN-topic --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

The recorder needs Playwright from `e2e/` (`npm install` there). Acronyms are spoken through `tools/video-audio/pronunciations.json`.

## Background music

Every video lays `assets/music/on-the-beach-intro-outro.mp3` under its narration (`--music`), the same track as the Sweet Hand videos. The source and licence are in `assets/music/README.md`.

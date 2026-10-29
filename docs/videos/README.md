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
| J01 | [Sign up and sign in](journeys/01-sign-up-and-sign-in/README.md) | 1:45 | Sign up and sign in |
| J02 | [Administer mechanics and shops](journeys/02-administer-mechanics-and-shops/README.md) | 1:54 | Administer mechanics and shops |
| J03 | [Manage availability](journeys/03-manage-availability/README.md) | 1:50 | Manage availability |
| J04 | [Manage vehicles](journeys/04-manage-vehicles/README.md) | 1:51 | Manage vehicles |
| J05 | [Pay for an inspection](journeys/05-pay-for-inspection/README.md) | 2:02 | Pay for inspection |
| J06 | [Book a video inspection](journeys/06-book-a-video-inspection/README.md) | 2:04 | Book a video inspection |
| J07 | [Reschedule or cancel a booking](journeys/07-reschedule-or-cancel-booking/README.md) | 1:55 | Reschedule or cancel booking |
| J08 | [Add an additional vehicle](journeys/08-add-additional-vehicle/README.md) | 2:09 | Add additional vehicle |
| J09 | [Add a body shop review](journeys/09-add-body-shop-review/README.md) | 2:05 | Add body shop review |

| J10 | [Join a live video inspection](journeys/10-join-live-video-inspection/README.md) | 2:36 | Join live video inspection |
| J11 | [Receive the safety certification estimate](journeys/11-receive-safety-certification-estimate/README.md) | 2:27 | Receive safety certification estimate |
| J12 | [Conduct a body shop review](journeys/12-conduct-body-shop-review/README.md) | 2:13 | Conduct body shop review |
| J13 | [Compare vehicle estimates](journeys/13-compare-vehicle-estimates/README.md) | 2:09 | Compare vehicle estimates |
| J14 | [Review inspection history](journeys/14-review-inspection-history/README.md) | 2:25 | Review inspection history |

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

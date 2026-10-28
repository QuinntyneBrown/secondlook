# 02 · Administer mechanics and shops: implementation demo

> **Runtime:** about 1 min 54 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real admin app and API (SQLite, synthetic data). No email is sent; the local mailbox adapter keeps the set-password link in memory.

| Scene | Clip | Content |
|---|---|---|
| The admin app | `clips/app.mp4` | Administrator sign-in, provider list, onboard dialog (invalid, then valid), approve, deactivate with Cancel focused, approve again, a buyer refused |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/02-administer-mechanics-and-shops/record.mjs   # starts and stops only its own API and admin app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/02-administer-mechanics-and-shops
node tools/video-build/build-video.mjs docs/videos/journeys/02-administer-mechanics-and-shops --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `02-administer-mechanics-and-shops.mp4` (1920x1080, H.264 + AAC).

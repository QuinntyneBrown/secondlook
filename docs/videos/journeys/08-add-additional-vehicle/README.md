# 08 · Add an additional vehicle: implementation demo

> **Runtime:** about 2 min 9 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data) with the **local payment adapter**: nothing is ever charged.

| Scene | Clip | Content |
|---|---|---|
| Adding a second car | `clips/app.mp4` | Dashboard window banner, the "Add another car for $25" dialog (empty VIN error, Both), the booking flow opening with the VIN filled in, the $45 order, payment, confirmation, and the "added for $45" announcement |
| The server decides | `clips/api.mp4` | `GET /api/pricing-window` for a new buyer (None) and after paying (Open, 1 car); the quote is $50 first and $25 for another car |
| Closing soon and closed | narration | The banner states, the 14-day rule and its exact boundary are covered by API tests and a banner unit test (they need the clock moved) |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/08-add-additional-vehicle/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/08-add-additional-vehicle
node tools/video-build/build-video.mjs docs/videos/journeys/08-add-additional-vehicle --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `08-add-additional-vehicle.mp4` (1920x1080, H.264 + AAC).

# 09 · Add a body shop review: implementation demo

> **Runtime:** about 2 min 5 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data) with the **local payment adapter**: nothing is ever charged.

| Scene | Clip | Content |
|---|---|---|
| Booking a combined call | `clips/app.mp4` | Review step (Body shop, then Both at $70), the schedule step offering the one time both providers share and naming both, payment, confirmation, and the inspection's team |
| The server decides | `clips/api.mp4` | `GET /api/slots` by kind (Mechanic, BodyShop, Both), an all-or-nothing combined hold, a rival buyer's 409, and the shared time gone afterwards |
| Cancel, reschedule, mismatches | narration | Covered by API tests (both slots released or moved; holds that do not fit the paid review are refused) |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/09-add-body-shop-review/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/09-add-body-shop-review
node tools/video-build/build-video.mjs docs/videos/journeys/09-add-body-shop-review --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `09-add-body-shop-review.mp4` (1920x1080, H.264 + AAC).

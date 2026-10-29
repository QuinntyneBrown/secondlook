# 12 · Conduct a body shop review: implementation demo

> **Runtime:** about 2 min 13 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). The local payment and mail adapters are used, so nothing is charged or sent.

| Scene | Clip | Content |
|---|---|---|
| The shop's queue | `clips/queue.mp4` | The body shop signs in and opens its assigned reviews: one waiting for its call, one ended and needing findings, two delivered; it joins the waiting call from the queue |
| Writing the findings | `clips/review.mp4` | After the call the shop writes its findings in the body review editor and submits; the queue shows the review as delivered |
| What the buyer reads | `clips/report.mp4` | The buyer's report keeps the mechanic's estimate and the body shop's findings apart; then a review with the shop alone, which has no certification estimate |
| The rules | `clips/api.mp4` | Real API calls: 409 before the call, 403 for the buyer and the mechanic, 404 for an unassigned shop and a stranger, 400 for empty findings, and the queue |

Not shown, and not built yet (ADR 0014): notifying the buyer that the body review is ready (J14), recording and screenshots, and a checklist for a call with the body shop alone.

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/12-conduct-body-shop-review/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
PYTHON=python node tools/video-audio/generate-audio.mjs docs/videos/journeys/12-conduct-body-shop-review
node tools/video-build/build-video.mjs docs/videos/journeys/12-conduct-body-shop-review --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `12-conduct-body-shop-review.mp4` (1920x1080, H.264 + AAC); `captions.srt` and `poster.png` come from `.cache/12-conduct-body-shop-review/`.

# 05 · Pay for an inspection: implementation demo

> **Runtime:** about 2 min 2 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). It uses the **local payment adapter**: no real card is used and nothing is ever charged. Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` is declined, `4000 0025 0000 3155` needs bank approval.

| Scene | Clip | Content |
|---|---|---|
| Paying | `clips/app.mp4` | Server-priced order ($50), invalid card summary, declined card with "Add a different card", successful payment, billing history, then the $45 price for the next vehicle with both reviews |
| Safe payments | `clips/api.mp4` | The same checkout key returns one checkout; five simultaneous payments return one payment and one charge; the receipt |
| Refunds | slide | The refund rules are shown as bullets and covered by automated tests (the booking journeys call the command) |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/05-pay-for-inspection/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/05-pay-for-inspection
node tools/video-build/build-video.mjs docs/videos/journeys/05-pay-for-inspection --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `05-pay-for-inspection.mp4` (1920x1080, H.264 + AAC).

# 13 · Compare vehicle estimates: implementation demo

> **Runtime:** about 2 min 9 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). The local payment adapter is used, so nothing is charged.

| Scene | Clip | Content |
|---|---|---|
| Lining the cars up | `clips/compare.mp4` | A buyer with four cars in one window opens Compare: three cars with estimates lowest all-in first with the cheapest marked, the fourth still pending at the end; the lowest car's report shows the same total |
| On a phone | `clips/phone.mp4` | The same page at phone width: the cars stack in one column and nothing scrolls sideways |
| Only your own cars | `clips/api.mp4` | Real API calls: the buyer's four cars, another buyer's two, a buyer with none, 403 for the mechanic, 401 with no token, and the report total matching its column |

Not shown, and not built yet (ADR 0015): the make, model and location of each car (the booking does not capture them, so a car is shown by its VIN and kilometres), comparing across windows, and removing a car from the comparison.

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/13-compare-vehicle-estimates/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
PYTHON=python node tools/video-audio/generate-audio.mjs docs/videos/journeys/13-compare-vehicle-estimates
node tools/video-build/build-video.mjs docs/videos/journeys/13-compare-vehicle-estimates --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `13-compare-vehicle-estimates.mp4` (1920x1080, H.264 + AAC); `captions.srt` and `poster.png` come from `.cache/13-compare-vehicle-estimates/`. The phone clip is recorded at 390x844 and centred on a 1920x1080 canvas.

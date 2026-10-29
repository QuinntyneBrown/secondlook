# 14 · Review inspection history: implementation demo

> **Runtime:** about 2 min 25 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). The local payment adapter is used, so nothing is charged.

| Scene | Clip | Content |
|---|---|---|
| Active and Past | `clips/history.mp4` | A buyer with four inspections: the two not finished with under Active, a completed one with its estimate and a cancelled one under Past; the completed row opens its report, Back returns to the Past tab, the cancelled row opens the car and refund it was booked with |
| A long history | `clips/long.mp4` | A buyer with 45 past inspections: 20 to a page, "45 inspections · 20 per page", "Showing 1–20 of 45", Previous disabled on the first page and Next on the last |
| Empty, failed and busy | `clips/states.mp4` | No inspections and the made-up sample report; a list that fails to load and recovers with Try again; the busy list with placeholder rows |
| Only your own history | `clips/api.mp4` | Real API calls: the tabs and counts, a page past the end, a different buyer, an unknown tab (400), the mechanic (403) and no token (401) |

Not shown, and not built yet (ADR 0016): the make, model and location of each car (the booking does not capture them, so rows show the VIN) and a retention policy for past inspections.

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/14-review-inspection-history/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
PYTHON=python node tools/video-audio/generate-audio.mjs docs/videos/journeys/14-review-inspection-history
node tools/video-build/build-video.mjs docs/videos/journeys/14-review-inspection-history --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `14-review-inspection-history.mp4` (1920x1080, H.264 + AAC); `captions.srt` and `poster.png` come from `.cache/14-review-inspection-history/`.

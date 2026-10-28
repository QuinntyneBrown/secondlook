# 06 · Book a video inspection: implementation demo

> **Runtime:** about 2 min 4 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). It uses the **local payment adapter**: nothing is ever charged and no email is sent.

| Scene | Clip | Content |
|---|---|---|
| Booking | `clips/app.mp4` | Empty dashboard, invalid then valid vehicle, review type with the server price ($70), free slots by day, hold, payment, "You’re booked for ...", inspection detail, dashboard row |
| Races and repeats | `clips/api.mp4` | Two buyers hold the same slot at once (one 201, one 409); a booking confirmed five times at once returns one inspection |
| Losing a slot | slide | Pay after the hold expired and the slot was taken: refused and refunded in full; covered by automated tests (it needs a 10-minute wait) |

Recording this demo found a real bug (a late price for an earlier review overwrote the chosen review's price in the order summary); it was fixed with a regression test before the final recording.

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/06-book-a-video-inspection/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/06-book-a-video-inspection
node tools/video-build/build-video.mjs docs/videos/journeys/06-book-a-video-inspection --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `06-book-a-video-inspection.mp4` (1920x1080, H.264 + AAC).

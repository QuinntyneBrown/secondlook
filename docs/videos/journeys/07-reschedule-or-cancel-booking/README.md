# 07 · Reschedule or cancel a booking: implementation demo

> **Runtime:** about 1 min 55 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). It uses the **local payment adapter**: no real money moves and no text message is sent.

| Scene | Clip | Content |
|---|---|---|
| Rescheduling and cancelling | `clips/app.mp4` | Reschedule dialog (choose-a-time error, new time, "Rescheduled to ..." with Undo, undo), cancel dialog (Keep inspection focused, reason required, full-refund text), the cancelled view and the Past tab |
| Staying consistent | `clips/api.mp4` | A taken slot refuses a reschedule (409) and the original time stays; five simultaneous cancels return one cancelled inspection and one refund; one refunded receipt |
| Late cancellation, started calls | narration | The $25 fee under 2 hours and "a started call cannot change" are covered by automated tests (they need the clock moved) |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/07-reschedule-or-cancel-booking/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/07-reschedule-or-cancel-booking
node tools/video-build/build-video.mjs docs/videos/journeys/07-reschedule-or-cancel-booking --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `07-reschedule-or-cancel-booking.mp4` (1920x1080, H.264 + AAC).

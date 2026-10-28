# 03 · Manage availability: implementation demo

> **Runtime:** about 1 min 50 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data).

| Scene | Clip | Content |
|---|---|---|
| Saving availability | `clips/app.mp4` | Mechanic signs in; invalid window refused; valid window saved (8 slots); overlap refused; edit moves the start earlier |
| What buyers see | `clips/api.mp4` | A buyer lists slots (10 half-hour slots); an administrator deactivates the mechanic and the list is empty; approving restores it |
| Booked times | slide | Reservation uniqueness and the booked-window rule are shown as bullets and covered by automated tests; the booking journeys will call them |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/03-manage-availability/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/03-manage-availability
node tools/video-build/build-video.mjs docs/videos/journeys/03-manage-availability --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `03-manage-availability.mp4` (1920x1080, H.264 + AAC).

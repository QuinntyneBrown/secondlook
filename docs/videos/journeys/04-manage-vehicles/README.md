# 04 · Manage vehicles: implementation demo

> **Runtime:** about 1 min 51 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data).

| Scene | Clip | Content |
|---|---|---|
| The list | `clips/app.mp4` | New buyer: empty list, invalid add (summary and field errors), add, duplicate VIN refused, edit, remove with Cancel focused |
| Whose cars | `clips/api.mp4` | Another buyer lists (empty), reads (404) and deletes (404) the first buyer's vehicle; the owner reads and deletes it |
| History | slide | Soft removal and booked-inspection history are shown as bullets and covered by automated tests (no inspections exist yet) |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/04-manage-vehicles/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/04-manage-vehicles
node tools/video-build/build-video.mjs docs/videos/journeys/04-manage-vehicles --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `04-manage-vehicles.mp4` (1920x1080, H.264 + AAC).

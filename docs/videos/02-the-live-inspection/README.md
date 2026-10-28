# 02 · The live inspection

> **Runtime:** ~2.2 min · **Audience:** buyers, and anyone reviewing the inspection journey · **Prerequisites:** [01 · Booking an inspection](../01-booking-an-inspection/README.md)

**Video:** [02-the-live-inspection.mp4](02-the-live-inspection.mp4) · [Slides](slides.html) · **Audio:** [02-the-live-inspection.mp3](02-the-live-inspection.mp3) · [Transcript](script.md)

## Why this video exists

Journey 2 of [user-journeys.md](../../user-journeys.md): the buyer joins the live video inspection. It is recorded from the static mocks through the throwaway demo server.

## Learning objectives

By the end, the viewer can:

- Say when the call opens and how to join it.
- Describe what the lobby checks and who is shown there.
- Follow the checklist and notes on the call, and know what happens if the connection drops.
- Say what the end-of-call summary contains.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When can I join? | 15 minutes before the start time |
| Is the call recorded? | Yes, so the mechanic can write the report; everyone is told first |
| What if my connection drops? | A reconnecting message; the others can still hear each other; it clears on its own, usually within 10 seconds |
| What can't be inspected? | Shown in the summary, e.g. the underbody when the car is not on a lift |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/mocks/pages/inspection-detail/default.html` | Booking, seller, team, Join the call |
| `docs/mocks/pages/call-lobby/default.html` | Camera, microphone, who's here |
| `docs/mocks/pages/live-inspection/default.html` | Checklist, notes, Mute |
| `docs/mocks/pages/live-inspection/offline.html` | Reconnecting message |
| `docs/mocks/dialogs/end-call/default.html` and `pages/live-inspection/ended.html` | Confirm, then the summary |

Recordings: `clips/detail`, `lobby`, `live`, `offline`, `end`.

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:10 | Introduction | The day of the inspection |
| 00:10-00:26 | Before the call | Inspection page, 15-minute window |
| 00:26-00:45 | The lobby | Devices, who is here, recording notice |
| 00:45-01:24 | On the call | Checklist, notes, Mute, dropped connection |
| 01:24-01:52 | Ending the call | Confirm, summary, report within an hour |
| 01:52-02:10 | Recap | Four things to remember |

## Demo commands

```sh
node tools/video-record/mock-demo-server.mjs            # leave running
node tools/video-record/record-clips.mjs docs/videos/02-the-live-inspection
node tools/video-audio/generate-audio.mjs docs/videos/02-the-live-inspection
node tools/video-build/build-video.mjs docs/videos/02-the-live-inspection --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

## Pitfalls

- The offline state is shown by opening its mock directly; there is no real connection to drop.

# 10 · Join a live video inspection: implementation demo

> **Runtime:** about 2 min 36 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). Two separate browser sessions, one for the buyer and one for the mechanic, use Chromium's synthetic camera and microphone. Nothing is recorded, charged or sent.

| Scene | Clip | Content |
|---|---|---|
| Joining the call | `clips/join.mp4` | Buyer (left) and mechanic (right): the lobby with who is here, both join, each sees the other's live video |
| Inspecting together | `clips/inspect.mp4` | The mechanic marks brakes done and adds a note; the buyer's checklist and notes change; only the mechanic has the buttons |
| When the connection drops | `clips/recover.mp4` | The buyer's connection is cut and recovers by itself; the end-call confirmation; the "Call ended" summary on both sides |
| Who may join | `clips/api.mp4` | Real API calls: an outsider gets 404, no token gets 401, the buyer gets 403 on the checklist, ending twice is safe |

Not shown, and not built yet (ADR 0012): recording, the seller joining from a text link, the weak-connection banners, and calls across strict firewalls (no STUN or TURN). The "Disconnected" and "Rejoin the call" state is covered by the acceptance test `a dropped connection reconnects, and a failed one can be rejoined`, not by this recording.

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/10-join-live-video-inspection/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
PYTHON=python node tools/video-audio/generate-audio.mjs docs/videos/journeys/10-join-live-video-inspection
node tools/video-build/build-video.mjs docs/videos/journeys/10-join-live-video-inspection --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `10-join-live-video-inspection.mp4` (1920x1080, H.264 + AAC); `captions.srt` and `poster.png` come from `.cache/10-join-live-video-inspection/`.

# 11 · Receive the safety certification estimate: implementation demo

> **Runtime:** about 2 min 27 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real app and API (SQLite, synthetic data). The local mail adapter carries the share email, so nothing is sent, and the local payment adapter means nothing is charged.

| Scene | Clip | Content |
|---|---|---|
| Writing the estimate | `clips/mechanic.mp4` | The mechanic adds findings in a dialog (a reversed cost range is refused with its reason), then submits |
| Reading the report | `clips/buyer.mp4` | The buyer's report: certification cost, all-in total, findings with status as words, the not-a-certificate statement, the PDF download and an issue report that needs a reason |
| Sharing it | `clips/share.mp4` | The buyer (left) shares the report; a browser with no account (right) reads it through the link; turning the link off changes what it shows |
| The rules | `clips/api.mp4` | Real API calls: 409 before the call has ended, 403 for the buyer, 400 for a reversed range, 404 for a stranger and for an unknown link, and the PDF |

Not shown, and not built yet (ADR 0013): the body shop's findings (J12), notifications that a report is ready (J14), comparing cars (J13), a mechanic reply to an issue, and "PDF with call screenshots" (nothing is recorded).

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/11-receive-safety-certification-estimate/record.mjs   # starts and stops only its own API and buyer app
python -m pip install edge-tts
PYTHON=python node tools/video-audio/generate-audio.mjs docs/videos/journeys/11-receive-safety-certification-estimate
node tools/video-build/build-video.mjs docs/videos/journeys/11-receive-safety-certification-estimate --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `11-receive-safety-certification-estimate.mp4` (1920x1080, H.264 + AAC); `captions.srt` and `poster.png` come from `.cache/11-receive-safety-certification-estimate/`.

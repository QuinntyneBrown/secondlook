# 03 · Your safety estimate

> **Runtime:** ~2.3 min · **Audience:** buyers, and anyone reviewing the estimate journey · **Prerequisites:** [02 · The live inspection](../02-the-live-inspection/README.md)

**Video:** [03-your-safety-estimate.mp4](03-your-safety-estimate.mp4) · [Slides](slides.html) · **Audio:** [03-your-safety-estimate.mp3](03-your-safety-estimate.mp3) · [Transcript](script.md)

## Why this video exists

Journey 3 of [user-journeys.md](../../user-journeys.md): the buyer reads the safety certification estimate and decides. It is recorded from the static mocks through the throwaway demo server.

## Learning objectives

By the end, the viewer can:

- Find the estimated cost to get the car safety certified, and the all-in cost with the asking price.
- Tell required repairs from recommended ones, and say what passes.
- Explain that body shop repairs are priced separately.
- Use compare, or add another car for $25, to decide.

## Key questions

| Question | What a strong answer includes |
|---|---|
| When does the report arrive? | Within an hour of the call |
| What if the body shop review isn't done? | The mechanic's estimate is shown first; the body shop review is usually about 30 minutes behind, and we notify the buyer |
| What is the all-in cost? | Asking price plus the cost to certify |
| Is the cheapest car the best car? | Not always; the decision is the buyer's |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/mocks/pages/report/partial.html` | Body shop review still in progress |
| `docs/mocks/pages/report/default.html` | Headline, findings, body shop section, "Is it worth it?" |
| `docs/mocks/pages/compare/default.html` | Reports side by side, lowest all-in first |

Recordings: `clips/partial`, `estimate`, `findings`, `bodyshop`, `decide`.

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:13 | Introduction | The number the buyer wants |
| 00:13-00:29 | Getting the report | Within an hour; partial state |
| 00:29-00:51 | The estimate | Headline range, all-in cost |
| 00:51-01:15 | The findings | Required, recommended, passes |
| 01:15-01:35 | The body shop | Separate section and pricing |
| 01:35-01:56 | The decision | Compare, add another car for $25 |
| 01:56-02:18 | Recap | Five things to remember |

## Demo commands

```sh
node tools/video-record/mock-demo-server.mjs            # leave running
node tools/video-record/record-clips.mjs docs/videos/03-your-safety-estimate
node tools/video-audio/generate-audio.mjs docs/videos/03-your-safety-estimate
node tools/video-build/build-video.mjs docs/videos/03-your-safety-estimate --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

## Pitfalls

- The clips skip the notification: in the mocks, the notification and dashboard rows for "Mazda3" open the Civic report, so the recording opens the report directly.

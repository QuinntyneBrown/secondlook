# 01 · Booking an inspection

> **Runtime:** ~2.2 min · **Audience:** buyers, and anyone reviewing the booking journey · **Prerequisites:** none

**Video:** [01-booking-an-inspection.mp4](01-booking-an-inspection.mp4) · [Slides](slides.html) · **Audio:** [01-booking-an-inspection.mp3](01-booking-an-inspection.mp3) · [Transcript](script.md)

## Why this video exists

Journey 1 of [user-journeys.md](../../user-journeys.md): a buyer books a video inspection. It is recorded from the static mocks (a throwaway demo server wires their buttons together), so it shows the designed flow, not the built app.

## Learning objectives

By the end, the viewer can:

- Name the four booking steps: the car, the review, the time, payment.
- Say what the three review types are, and what "both" costs.
- State the pricing: $50 for the first inspection, $25 for each additional car in the window, +$20 for both reviews.

## Key questions

| Question | What a strong answer includes |
|---|---|
| What does the seller have to do? | Nothing to install; they get a text link to join the call |
| How long is a chosen time held? | 10 minutes |
| What if the seller doesn't join? | Full refund |
| Why is the example total $45? | $25 additional car + $20 for both reviews; the first car is $50 |

## Code / assets on screen

| File | What to show |
|---|---|
| `docs/mocks/pages/book-vehicle/default.html` | VIN, odometer, asking price, seller phone |
| `docs/mocks/pages/book-review-type/default.html` | Mechanic, body shop, both |
| `docs/mocks/pages/book-schedule/default.html` | Day and time chips, mechanic card |
| `docs/mocks/pages/checkout/default.html` | Order summary, seller confirmation, Pay $45 |
| `docs/mocks/pages/booking-confirmed/default.html` | What happens next, Add another car |

Recordings: `clips/vehicle`, `review`, `schedule`, `pay`, `booked`.

## Run sheet

| Time | Segment | Content |
|---|---|---|
| 00:00-00:16 | Introduction | What the video covers |
| 00:16-00:38 | The car | VIN, price, seller |
| 00:38-00:56 | The review | Mechanic, body shop, both |
| 00:56-01:11 | The time | Day, slot, 10-minute hold |
| 01:11-01:34 | Paying | $50 / $25 / +$20, refund |
| 01:34-01:54 | Booked | Confirmation, add another car |
| 01:54-02:13 | Recap | Four steps, pricing, refund |

## Demo commands

```sh
node tools/video-record/mock-demo-server.mjs            # leave running
node tools/video-record/record-clips.mjs docs/videos/01-booking-an-inspection
node tools/video-audio/generate-audio.mjs docs/videos/01-booking-an-inspection
node tools/video-build/build-video.mjs docs/videos/01-booking-an-inspection --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

## Pitfalls

- The mock order is an additional car ($25 + $20 = $45); the narration says so, because the first car is $50.

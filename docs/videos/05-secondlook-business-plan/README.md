# 05 · The SecondLook business plan

**Runtime:** 2:05 · **Audience:** partners, providers and funders meeting the plan for the first time · **Captions:** none, by design

[Watch the video](05-secondlook-business-plan.mp4) · [Narration](05-secondlook-business-plan.mp3) · [Transcript](script.md) · [Slides](slides.html) · [Poster](poster.png)

A picture-led explanation of [the business plan](../../business/business-plan.md): the problem, the service and its pricing, the launch market, the referral strategy, the trust rules, the three-year forecast, the funding stages and the first ninety days. Each scene is one narrated paragraph and carries only a few words; the numbers and illustrations do the explaining.

The plan is pre-launch. The video repeats its figures as forecasts and ends by saying so.

## Run sheet

| Time        | Scene (picture)                                  | Plan section              |
| ----------- | ------------------------------------------------ | ------------------------- |
| 00:00–00:05 | A car: "Buying as is?"                           | Customer and problem      |
| 00:05–00:12 | Clock, crossed-out wrench, car driving away      | Customer and problem      |
| 00:12–00:22 | Live video call beside a written estimate        | Service and pricing       |
| 00:22–00:34 | Price tags $50, $25, +$20 and a 14-day strip     | Service and pricing       |
| 00:34–00:41 | Greater Toronto Area map and three buyer types   | Market entry              |
| 00:41–00:55 | Hub-and-spoke referral network, 3–5 pilots       | Rodney-led distribution   |
| 00:55–01:08 | Buyer shield beside a crossed-out certificate    | Independence and trust    |
| 01:08–01:18 | Revenue bars: $47k, $179k, $512k                 | Three-year financial plan |
| 01:18–01:31 | Windows 720, 2,574, 6,930; about 500 a month     | Unit economics, break-even |
| 01:31–01:44 | Coin stacks: $35k now, $75k after the pilot      | Funding and use of cash   |
| 01:44–01:56 | Timeline: 15, 40, 60 windows at days 30, 60, 90  | First 90 days             |
| 01:56–02:05 | Mark: "Know the cost before you commit."         | Evidence and review       |

## Figures on screen

Every number comes from the business plan: net service revenue of $46,793, $178,520 and $512,224 (rounded to $47k, $179k, $512k); paid buying windows of 720, 2,574 and 6,930; Year 3 break-even of about 500 paid windows a month; staged funding of about $35,000 then $75,000 of a $110,000 target; and cumulative 90-day targets of about 15, 40 and 60 paid windows.

## Sound

Narrator: Edge TTS `en-US-AndrewMultilingualNeural`, the voice of the other videos. Music: the shared `../assets/music/on-the-beach-intro-outro.mp3`, mixed as in video 04 (narration at -18.3 LUFS, music at -11.43 dB, 1.5 s fade-in, 2.5 s fade-out) with a 3-second music-only ending. See the [music provenance](../assets/music/README.md).

## Styling

`slides.html` and `plan.css` use the brand palette from `../assets/mark.svg` (ink, cream, orange) with inline SVG illustrations. No captions are burned in or embedded; scene headlines are visual content, not a transcript overlay.

## Rebuild

From the repository root, with Python `edge-tts`, FFmpeg and Playwright (installed under `e2e/`):

```sh
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/05-secondlook-business-plan
node docs/videos/05-secondlook-business-plan/build.mjs
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height docs/videos/05-secondlook-business-plan/05-secondlook-business-plan.mp4
```

Generation writes timing to `.cache/05-secondlook-business-plan/` (ignored by git); `build.mjs` renders the twelve scenes, cuts them at the measured paragraph starts and encodes the MP4 and poster.

Verified output: 124.6 seconds, 1920×1080, H.264 video and AAC audio, no subtitle stream. All twelve scenes were reviewed, and a frame at 70 s shows the revenue scene during the matching narration.

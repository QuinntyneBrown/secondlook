# 00 · Initial setup and platform: implementation demo

> **Runtime:** about 2 min 10 s · **Audience:** developers and reviewers · **Prerequisites:** a restored checkout (see [the setup runbook](../../../setup-runbook.md))

**Video:** [00-initial-setup-and-platform.mp4](00-initial-setup-and-platform.mp4) · [Slides](slides.html) · **Audio:** [mp3](00-initial-setup-and-platform.mp3) · [Transcript](script.md) · [Captions](captions.srt) · [Chapters](chapters.json) · [Poster](poster.png)

This is an **implementation demo**: the clips are recorded from the real API, CLI and buyer app running locally against a throwaway SQLite database with synthetic identities. It is not a mock walkthrough; videos 01 to 03 are the mock-based design walkthroughs and are unchanged.

## What it shows

| Scene | Clip | Content |
|---|---|---|
| Setup | `clips/setup.mp4` | `eng/Start-E2eApi.ps1` (migrate, seed, start API), a second `secondlook seed` (idempotent), and `seed` on a never-migrated file (refused) |
| Access | `clips/access.mp4` | `/health/ready` 200, anonymous 401, buyer token 200, buyer on admin 403, admin fault 500; all errors are problem+json with a trace id. The token is redacted on screen |
| The apps | `clips/app.mp4` | Buyer shell in Chromium: API ready, 404 page, API connection cut so the 500 page shows, then "Try again" recovers |

## Disclosures

- The 500 scene cuts the browser's connection with a Playwright route; the 500 in the Access scene is a real server fault from the development-only `/api/platform/diagnostics/fault` endpoint.
- Payment and video are not part of this journey. No real charge is made and no email is sent.
- Tokens are signed with a throwaway development key; nothing secret appears in the repository or the video.

## Re-run

From the repository root, with .NET 10, Node 22, PowerShell 7 and ffmpeg installed and the solution built (`dotnet build backend/SecondLook.sln`):

```sh
node docs/videos/journeys/00-initial-setup-and-platform/record.mjs          # clips/*.mp4 (starts and stops only its own processes)
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/00-initial-setup-and-platform
node tools/video-build/build-video.mjs docs/videos/journeys/00-initial-setup-and-platform --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

Verify: `ffprobe -v error -show_entries format=duration:stream=codec_name,width,height docs/videos/journeys/00-initial-setup-and-platform/00-initial-setup-and-platform.mp4` reports 1920x1080 H.264 plus AAC audio.

The narration voice is the repository's edge-tts default; `captions.srt` is the transcript timing and is also burned into the MP4.

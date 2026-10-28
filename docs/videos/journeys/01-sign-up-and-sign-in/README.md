# 01 · Sign up and sign in: implementation demo

> **Runtime:** about 1 min 45 s · **Audience:** developers and reviewers

**Video:** [demo.mp4](demo.mp4) · [Slides](slides.html) · [Transcript](script.md) · [Captions](captions.srt) · [Poster](poster.png)

An **implementation demo** recorded from the real buyer app and API (SQLite, synthetic data). The mail adapter is the in-memory local mailbox, so no email is sent; the emailed link is read from the Development-only mailbox endpoint.

| Scene | Clip | Content |
|---|---|---|
| The app | `clips/app.mp4` | Invalid sign-up summary, sign-up, check-your-email, sign-in refused before verification, verification link, wrong then right password, sign-out dialog, forgot and reset password |
| Providers | `clips/api.mp4` | A body shop registers, verifies and signs in with `isApproved: false`; registering as Admin is refused |

## Re-run

From the repository root with the solution built:

```sh
node docs/videos/journeys/01-sign-up-and-sign-in/record.mjs   # starts and stops only its own API and app
python -m pip install edge-tts
node tools/video-audio/generate-audio.mjs docs/videos/journeys/01-sign-up-and-sign-in
node tools/video-build/build-video.mjs docs/videos/journeys/01-sign-up-and-sign-in --music docs/videos/assets/music/on-the-beach-intro-outro.mp3
```

`demo.mp4` is a copy of the built `01-sign-up-and-sign-in.mp4` (1920x1080, H.264 + AAC).

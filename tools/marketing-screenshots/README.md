# Marketing screenshots

Captures the images on the marketing site (`marketing/`, ADR-018) from the real app, so the page never shows a mock-up:

- `marketing/assets/screenshots/{weekend,ideas,family,past}.png`: phone screens at 390x844, 2x
- `marketing/assets/screenshots/weekend-desktop.png`: the Weekend screen at 1440x900 for the hero's browser frame
- `marketing/assets/social-card.png`: `social-card.html` at 1200x630, the Open Graph image

It copies the screenshots to `docs/mocks/images/marketing/` too, so the mock shows the same pixels and the visual spec stays unmasked.

## Run it

Start the API against a seeded, disposable database and the family app (see `tools/video-record/family-demo/README.md`), then from the repository root:

```sh
node tools/marketing-screenshots/capture.mjs
cd e2e && npm run test:marketing      # the gallery and metadata specs check the new files
npx cross-env SL_BASELINE=1 playwright test --project=marketing --update-snapshots all tests/visual/marketing.visual.spec.ts
```

`SL_APP_URL`, `SL_API_URL`, `SL_DEMO_EMAIL` and `SL_DEMO_PASSWORD` override the defaults (`http://localhost:4200`, `http://localhost:5100` and the seeded family account).

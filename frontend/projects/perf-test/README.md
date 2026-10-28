# Perf test

The Angular port of Fluent UI's [`apps/perf-test`](https://github.com/QuinntyneBrown/fluentui/tree/master/apps/perf-test)
(ADR-014). It renders a scenario many times in Chromium with the V8 CPU
profiler running, so slow components stand out and changes in render cost show
up on pull requests.

It runs on every pull request that touches `frontend/` (`.github/workflows/perf-test.yml`):
both this PR and its base branch are built and measured, and the comparison
table lands in the job summary. The `.cpuprofile` files are uploaded as the
`perf-test-logfiles` artifact.

## Pieces

| Path                                          | What it is                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/projects/perf-test/src/scenarios/`  | One file per scenario. The default export is the component rendered once per iteration; an optional `decorator` export wraps all iterations once (a list, a theme). |
| `frontend/projects/perf-test/src/renderer.ts` | Reads `?scenario=&iterations=&renderType=`, renders, and appends `#render-done` with the measured time.                                                             |
| `e2e/perf-test/perf-test.mjs`                 | The runner: serves the build(s), profiles each scenario with Playwright's Chromium, writes the report.                                                              |
| `e2e/perf-test/config/`                       | Iterations per scenario, render types per scenario, runs, thresholds, excluded scenarios.                                                                           |
| `e2e/perf-test/logfiles/`                     | Output: `perf-test.md`, `results.json`, one `.cpuprofile` per scenario, render type and build (git-ignored).                                                        |

## Running locally

```bash
cd frontend
NG_BUILD_MANGLE=0 npx ng build perf-test   # keeps function names readable in the profiles

cd ../e2e
npx playwright install chromium           # once
npm run perf-test
```

Options (after `npm run perf-test --`):

| Option                    | Effect                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| `--scenarios Button,Day`  | Only these scenarios (names are the scenario file names).                        |
| `--iterations 500`        | Override every scenario's iteration count.                                       |
| `--runs 5`                | Measured loads per scenario, render type and build; the report shows the median. |
| `--baseline <dist>`       | A second build to compare against, such as `main` built in a worktree.           |
| `--dist <dist>`           | The build under test (default `frontend/dist/perf-test/browser`).                |
| `--out <dir>`             | Where to write the report and profiles.                                          |
| `--fail-on-regression`    | Exit non-zero when a row is flagged. Failed scenarios always exit non-zero.      |
| `--chromium <executable>` | A Chromium binary other than Playwright's download.                              |

To look at a single scenario in the browser, run `npx ng serve perf-test` and
open `http://localhost:4200/?scenario=Day&iterations=10`.

## Render types

| Render type                     | What is measured                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `mount` (every scenario)        | Creating `iterations` instances and one change-detection pass over them.               |
| `virtual-rerender`              | One instance change-detected `iterations` times: the steady-state update cost.         |
| `virtual-rerender-with-unmount` | One instance created, rendered and destroyed `iterations` times: create/teardown cost. |

List a scenario in `e2e/perf-test/config/scenario-render-types.mjs` to add the
re-render types.

## Adding a scenario

1. Add `src/scenarios/<Name>.ts` with a standalone component as its default
   export, rendering one realistic instance (the Default story is a good
   starting point).
2. Export it from `src/scenarios/index.ts` as `export * as <Name> from './<Name>';`.
   The runner discovers scenarios from the file names and fails one the app
   cannot render, so a forgotten export shows up immediately.
3. If one instance is expensive, lower its iterations in
   `e2e/perf-test/config/scenario-iterations.mjs` so the scenario renders in
   roughly 100–300 ms.

## Reading the report

- **Render** is `performance.measure` around creating and change-detecting the
  scenario, the number compared against the baseline.
- **Ticks** are non-idle profiler samples (100 µs apart) for the whole page
  load, as in Fluent's report. They include bootstrap, so they move less than
  render time.
- A row is flagged **Possible regression** when the median is more than 10%
  (and at least 1 ms) slower than the baseline _and_ every PR run was slower
  than every baseline run. Same-build comparisons still move by 5–15% on a
  shared runner, so treat a flag as a prompt to open the profile, not a verdict.
- The **Hottest functions** tables list self ticks per function. To see the
  full call tree, load a `.cpuprofile` into Chrome DevTools (Performance panel →
  Load profile) or [speedscope](https://www.speedscope.app/) for a flame graph.

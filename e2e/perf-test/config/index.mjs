import { fileURLToPath } from 'node:url';

import { scenarioIterations } from './scenario-iterations.mjs';
import { DefaultRenderTypes, scenarioRenderTypes } from './scenario-render-types.mjs';

const resolve = (path) => fileURLToPath(new URL(path, import.meta.url));

export const config = {
  /** Folder whose file names are the scenario names. */
  scenariosSrcDirPath: resolve('../../../frontend/projects/perf-test/src/scenarios'),
  /** `ng build perf-test` output. */
  distDir: resolve('../../../frontend/dist/perf-test/browser'),
  /** Reports, results JSON and .cpuprofile files. */
  outDir: resolve('../logfiles'),
  defaultIterations: 1000,
  /** Measured page loads per scenario, render type and target; the report shows the median. */
  runs: 5,
  /** A median this much slower than the baseline (and at least `regressionMinMs`) is flagged. */
  regressionThreshold: 0.1,
  regressionMinMs: 1,
  /** Profiler sampling interval in microseconds; each sample is one tick. */
  samplingIntervalUs: 100,
  scenarioIterations,
  scenarioRenderTypes,
  defaultRenderTypes: DefaultRenderTypes,
  excludeScenarios: [],
};

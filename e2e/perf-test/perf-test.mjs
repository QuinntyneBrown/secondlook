#!/usr/bin/env node
// SecondLook perf test: the Angular port of Fluent UI's apps/perf-test.
//
// Loads each scenario of the `perf-test` app in Chromium with the V8 CPU
// profiler running, waits for `#render-done`, and records the render time
// and profiler ticks. Given a baseline build (usually the base branch), it
// runs both builds interleaved and flags render-time regressions.
//
//   npm run perf-test -- [--scenarios Button,Day] [--iterations 500] [--runs 5]
//                        [--baseline <dist>] [--dist <dist>] [--out <dir>]
//                        [--fail-on-regression] [--chromium <executable>]
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from '@playwright/test';

import { config } from './config/index.mjs';
import { countTicks, topFunctions } from './profile.mjs';
import { analyse, renderReport } from './report.mjs';
import { serve } from './server.mjs';

const RENDER_TIMEOUT_MS = 120_000;

const { values: args } = parseArgs({
  options: {
    scenarios: { type: 'string' },
    iterations: { type: 'string' },
    runs: { type: 'string' },
    dist: { type: 'string', default: config.distDir },
    baseline: { type: 'string' },
    out: { type: 'string', default: config.outDir },
    'fail-on-regression': { type: 'boolean', default: false },
    // A Chromium binary other than Playwright's own download.
    chromium: { type: 'string' },
  },
});

const runs = Number(args.runs ?? config.runs);
const outDir = resolve(args.out);
mkdirSync(outDir, { recursive: true });

const scenarios = listScenarios();
const targets = [{ name: 'pr', dist: resolve(args.dist) }];
if (args.baseline) targets.unshift({ name: 'baseline', dist: resolve(args.baseline) });

for (const target of targets) Object.assign(target, await serve(target.dist));
const browser = await chromium.launch({ executablePath: args.chromium });

const results = [];
try {
  for (const scenario of scenarios) {
    const iterations = Number(
      args.iterations ?? config.scenarioIterations[scenario] ?? config.defaultIterations,
    );
    for (const renderType of config.scenarioRenderTypes[scenario] ?? config.defaultRenderTypes) {
      results.push(await measureScenario({ scenario, iterations, renderType }));
    }
  }
} finally {
  await browser.close();
  for (const target of targets) target.close();
}

const report = renderReport(results, {
  runs,
  hasBaseline: Boolean(args.baseline),
  regressionThreshold: config.regressionThreshold,
});
writeFileSync(join(outDir, 'perf-test.md'), report);
writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log(`\n${report}\nWrote ${join(outDir, 'perf-test.md')}`);

const failed = results.some((r) => r.error);
const regressed = results.some((r) => r.analysis?.status === 'regression');
process.exitCode = failed || (regressed && args['fail-on-regression']) ? 1 : 0;

/** Scenario names are the scenario file names, filtered by --scenarios and the exclude list. */
function listScenarios() {
  const all = readdirSync(config.scenariosSrcDirPath)
    .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
    .map((file) => file.slice(0, -3))
    .filter((name) => !config.excludeScenarios.includes(name));
  if (!args.scenarios) return all;
  const wanted = args.scenarios.split(',').map((s) => s.trim());
  const unknown = wanted.filter((name) => !all.includes(name));
  if (unknown.length)
    throw new Error(`Unknown scenario(s): ${unknown.join(', ')}. Known: ${all.join(', ')}`);
  return wanted;
}

/**
 * One warm-up load per target, then `runs` measured loads, alternating
 * targets so drift hits both. A scenario the baseline cannot render (it is
 * new in this PR) is reported without a comparison.
 */
async function measureScenario({ scenario, iterations, renderType }) {
  console.log(`▶ ${scenario} · ${renderType} · ${iterations}x`);
  const params = { scenario, iterations, renderType };
  const result = { scenario, renderType, iterations };
  const samples = new Map();
  try {
    for (const target of targets) {
      try {
        await load(target, params);
        samples.set(target, []);
      } catch (error) {
        if (target.name === 'pr') throw error;
        result.baselineError = firstLine(error);
        console.log(`  baseline skipped: ${result.baselineError}`);
      }
    }
    for (let run = 0; run < runs; run++) {
      for (const [target, list] of samples) list.push(await load(target, params));
    }
  } catch (error) {
    console.log(`  ✖ ${firstLine(error)}`);
    return { ...result, error: firstLine(error) };
  }

  for (const [target, list] of samples) {
    const { profile, ...summary } = summarise(list);
    const file = join(outDir, `${scenario}.${renderType}.${target.name}.cpuprofile`);
    writeFileSync(file, JSON.stringify(profile));
    result[target.name] = { ...summary, profileFile: file };
  }
  result.analysis = analyse(result, {
    ...config,
    hasBaseline: targets.length > 1,
  });
  const change =
    result.analysis.change == null
      ? ''
      : ` (${(result.analysis.change * 100).toFixed(1)}% vs baseline)`;
  console.log(`  ${result.pr.renderMs.toFixed(1)} ms, ${result.pr.ticks} ticks${change}`);
  return result;
}

function firstLine(error) {
  return error.message.split('\n')[0];
}

/** Loads one scenario in a fresh page with the profiler running from before navigation. */
async function load(target, { scenario, iterations, renderType }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => msg.type() === 'error' && pageErrors.push(msg.text()));

  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', {
    interval: config.samplingIntervalUs,
  });
  await cdp.send('Profiler.start');
  try {
    const query = new URLSearchParams({
      scenario,
      iterations: String(iterations),
      renderType,
    });
    await page.goto(`${target.origin}/?${query}`);
    const marker = await page
      .waitForSelector('#render-done', {
        state: 'attached',
        timeout: RENDER_TIMEOUT_MS,
      })
      .catch(() => {
        throw new Error(
          `#render-done never appeared${pageErrors.length ? `: ${pageErrors[0]}` : ''}`,
        );
      });
    const { profile } = await cdp.send('Profiler.stop');
    const { error, duration } = await marker.evaluate((el) => ({
      ...el.dataset,
    }));
    if (error) throw new Error(error);
    if (pageErrors.length) throw new Error(pageErrors[0]);
    return { renderMs: Number(duration), ticks: countTicks(profile), profile };
  } finally {
    await context.close();
  }
}

/** Medians across runs; keeps the profile of the run closest to the median render time. */
function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a.renderMs - b.renderMs);
  const medianRun = sorted[Math.floor(sorted.length / 2)];
  const ticks = samples.map((s) => s.ticks).sort((a, b) => a - b);
  return {
    renderMs: median(sorted.map((s) => s.renderMs)),
    minMs: sorted[0].renderMs,
    maxMs: sorted.at(-1).renderMs,
    ticks: Math.round(median(ticks)),
    runs: samples.map(({ renderMs, ticks }) => ({ renderMs, ticks })),
    topFunctions: topFunctions(medianRun.profile),
    profile: medianRun.profile,
  };
}

function median(values) {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

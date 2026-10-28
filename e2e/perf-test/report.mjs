const ms = (value) => (value == null ? "n/a" : `${value.toFixed(1)} ms`);
const pct = (value) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

/**
 * Compares the median render time of the PR against the baseline. A change
 * counts only when it clears the threshold *and* the two builds' runs do not
 * overlap, so a single noisy run cannot flag a row.
 */
export function analyse(
  result,
  { hasBaseline, regressionThreshold, regressionMinMs },
) {
  const { pr, baseline } = result;
  if (!hasBaseline) return { status: "measured" };
  if (!baseline) return { status: "new" };
  const delta = pr.renderMs - baseline.renderMs;
  const change = baseline.renderMs ? delta / baseline.renderMs : 0;
  if (
    change > regressionThreshold &&
    delta >= regressionMinMs &&
    pr.minMs > baseline.maxMs
  ) {
    return { status: "regression", change };
  }
  if (
    change < -regressionThreshold &&
    -delta >= regressionMinMs &&
    pr.maxMs < baseline.minMs
  ) {
    return { status: "improvement", change };
  }
  return { status: "unchanged", change };
}

const STATUS = {
  regression: "🔴 Possible regression",
  improvement: "🟢 Faster",
  unchanged: "No significant change",
  measured: "",
  new: "New scenario",
  failed: "❌ Failed",
};

/** The Markdown report: the comparison table, then the hottest functions per scenario. */
export function renderReport(
  results,
  { runs, hasBaseline, regressionThreshold },
) {
  const lines = ["## SecondLook perf test", ""];
  const failed = results.filter((r) => r.error);
  const regressions = results.filter(
    (r) => r.analysis?.status === "regression",
  );

  if (hasBaseline) {
    lines.push(
      regressions.length
        ? `**${regressions.length} possible regression(s)** (median render time more than ${pct(regressionThreshold)} slower than the baseline, with no overlap between runs).`
        : "No significant render-time regressions against the baseline.",
      "",
      "| Scenario | Render type | Iterations | Baseline | This PR | Change | Baseline ticks | PR ticks | Status |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    );
  } else {
    lines.push(
      "No baseline build was given, so these are absolute numbers only.",
      "",
      "| Scenario | Render type | Iterations | Render (median) | Render (min–max) | Ticks |",
      "| --- | --- | ---: | ---: | ---: | ---: |",
    );
  }

  for (const r of results) {
    const head = `| ${r.scenario} | ${r.renderType} | ${r.iterations}`;
    if (r.error) {
      lines.push(
        `${head} | ${STATUS.failed}: ${r.error.replace(/\|/g, "\\|")} |`,
      );
    } else if (hasBaseline) {
      const b = r.baseline;
      lines.push(
        `${head} | ${ms(b?.renderMs)} | ${ms(r.pr.renderMs)} | ${r.analysis.change == null ? "n/a" : pct(r.analysis.change)} | ${b?.ticks ?? "n/a"} | ${r.pr.ticks} | ${STATUS[r.analysis.status]} |`,
      );
    } else {
      lines.push(
        `${head} | ${ms(r.pr.renderMs)} | ${ms(r.pr.minMs)} – ${ms(r.pr.maxMs)} | ${r.pr.ticks} |`,
      );
    }
  }

  lines.push(
    "",
    `Medians of ${runs} run${runs === 1 ? "" : "s"} after a warm-up load. Render time is \`performance.measure\` around creating and change-detecting the scenario; ticks are non-idle CPU profiler samples for the whole page load. Expect run-to-run variance of several percent: read a flagged row against its profile before treating it as real.`,
    "",
  );

  const profiled = results.filter((r) => !r.error);
  if (profiled.length) {
    lines.push(
      "<details><summary>Hottest functions (self ticks, this PR)</summary>",
      "",
    );
    for (const r of profiled) {
      lines.push(
        `#### ${r.scenario} · ${r.renderType}`,
        "",
        "| Function | Self ticks | Share |",
        "| --- | ---: | ---: |",
      );
      for (const f of r.pr.topFunctions) {
        lines.push(
          `| \`${f.name.replace(/\|/g, "\\|")}\` | ${f.self} | ${(f.share * 100).toFixed(1)}% |`,
        );
      }
      lines.push("");
    }
    lines.push("</details>", "");
  }

  if (failed.length)
    lines.push(`**${failed.length} scenario run(s) failed.**`, "");
  return lines.join("\n");
}

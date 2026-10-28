import { defineConfig } from 'vitest/config';

// Measurement harness setting (coverage-maximization plan P0.7): vitest's
// coverage.reportOnFailure defaults to false, so a run with failing tests
// writes no coverage report at all. The honest-denominator file list is
// passed via the builder's own --coverage-include option, NOT here — an
// include list in this config filters against a different root and zeroes
// the collected coverage (measured).
export default defineConfig({
  test: {
    coverage: {
      reportOnFailure: true,
    },
  },
});

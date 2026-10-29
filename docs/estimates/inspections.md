# Estimates: inspections

Only the designs touched so far are assessed; the others in this area are not yet estimated.

| Design | Effort | Complete |
|---|---|---|
| dashboard-list | 5 days | 85% |
| inspection-history | 3 days | 85% |

## Evidence after J14

- **dashboard-list (85%)**: delivered and tested: Active and Past tabs with counts, rows with status and estimate, 20 per page with totals and Previous and Next, loading, empty (with a sample report), empty-tab and failed states, scoping to the buyer. Remaining: make, model and location on rows (not captured at booking), the "Compare cars" link in the window banner.
- **inspection-history (85%)**: delivered and tested: the Past tab with completed and cancelled inspections, estimate summaries, the report and cancelled-inspection views reached from a row, and the tab and page kept in the address. Remaining: a retention policy.

Tests: 7 API integration tests in `HistoryTests` and 8 Chromium acceptance tests in `e2e/tests/history/history.spec.ts`.

# Estimates: reports

| Design | Effort | Complete |
|---|---|---|
| compare-estimates | 4 days | 0% |
| download-report | 2 days | 70% |
| report-issue | 2 days | 60% |
| share-report | 4 days | 85% |
| submit-estimate | 4 days | 85% |
| view-report | 5 days | 75% |

## Evidence after J11

- **submit-estimate (85%)**: delivered and tested: estimate editor with a finding dialog, server validation, after-call rule, replace on resubmission, mechanic-only. Remaining: body shop findings (J12), notifying the buyer that the report is ready (J14).
- **view-report (75%)**: delivered: report with totals, findings, not-a-certificate statement, not-ready, failed and not-found states, body shop "In progress". Remaining: "Compare with another car" and "Add another car" (J13), body shop findings (J12), notification promise (J14).
- **share-report (85%)**: delivered: link and email sharing through the local mailbox, 14-day expiry, turn off, anonymous read-only page without buyer details. Remaining: a real mail provider, a sharing audit trail.
- **download-report (70%)**: delivered: an in-process PDF copy with busy and failure states. Remaining: a designed PDF layout, "PDF with call screenshots" (needs recording).
- **report-issue (60%)**: delivered: reason and details stored with validation and failure states. Remaining: the mechanic seeing and answering issues, the one-business-day reply.
- **compare-estimates (0%)**: J13.

Tests: 15 API integration tests in `ReportTests` and 11 Chromium acceptance tests in `e2e/tests/report/report.spec.ts`.

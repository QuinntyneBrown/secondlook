# ADR 0013: The estimate report, its sharing links and the PDF copy

## Status
Accepted (J11)

## Context
`L1-010` and `L2-045` to `L2-050` describe the safety certification estimate: the mechanic writes it after the call, the buyer reads it, shares it, downloads it and can question it. The designs leave the PDF renderer, the share mechanism and the email provider as `<TO SUPPLY>`.

## Decision
- **One report per inspection, replaced on resubmission.** `PUT /api/inspections/{id}/report` by the assigned mechanic, only after the call has ended (409 before). It takes 1 to 30 findings (title up to 200 characters, note up to 500, status Required, Recommended or Passes, and a cost range in cents with both ends or neither, zero to $100,000, none for Passes). Submitting again replaces the findings, so the call is idempotent. Invalid input is a 400 and stores nothing.
- **Totals are computed on the server from Required findings only.** The certification cost is the sum of their ranges; the all-in total is the asking price plus that range. Recommended findings and passes are listed but not summed. Every report carries a fixed disclaimer that a remote estimate is not a safety certificate or a guarantee.
- **Who sees it:** the buyer, the assigned mechanic and an assigned body shop (same scoping as the call, ADR 0012). Anyone else gets 404; anonymous gets 401. Before the mechanic submits, a participant gets 409 "Your report isn’t ready yet".
- **The body shop part** is "NotRequested" when no body shop is assigned, otherwise "InProgress". The body shop's own findings arrive with J12, which changes that status to "Ready".
- **Sharing is a capability link.** `PUT .../report/share` returns the buyer's active link (a 256-bit random token, 14 days) or creates it, and asking again returns the same link. `POST .../report/share/email` sends it through the existing `IEmailSender` (the local mailbox here; no real mail leaves the machine). `DELETE .../report/share` turns it off and is idempotent; the next `PUT` makes a new token. `GET /api/shared-reports/{token}` is an **intentional anonymous endpoint**: it returns the report without any buyer details, with the body shop part only if the buyer included it, and answers 404 "This report isn’t shared with you" for an unknown, expired or turned-off link. The token is stored as issued (not hashed) because the same link must be returnable; it is only ever compared for equality and never logged.
- **The PDF is generated in-process** by a small text-only writer (`ReportPdf`): no library, no licence, no network. It is a record copy, not a designed document. `GET .../report/pdf` is available to the people who can read the report.
- **Reporting an issue** stores the reason (a fixed set) and optional details for the report; there is no reply workflow yet.

## Not in J11 (deferred and disclosed)
"PDF with call screenshots" (nothing is recorded, so there are no screenshots), the mechanic replying to an issue within a business day, notifying the buyer that the report is ready (J14), and the body shop findings (J12).

## Consequences
A buyer can read, share, download and question a mechanic's estimate with no third-party service. A leaked share link exposes one report until it expires or is turned off, which the buyer can do at any time.

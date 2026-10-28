# SecondLook mocks

Static HTML mocks for every page, dialog and notification of SecondLook, in every state. They open from disk with no server: start at [index.html](index.html).

SecondLook connects a used-car buyer with a local mechanic who inspects the car over video and estimates what it will cost to get it safety certified. A body shop review can be added, or both. The first inspection is $50 and every additional vehicle in the same window is $25.

## How to open

- Open `index.html` and follow the links, or open any file under `pages/`, `dialogs/` or `notifications/`.
- `?theme=dark` forces the dark theme. `?chrome=0` hides the mock bar and notes, leaving what the product would look like. Press `t` to toggle the theme.
- The pill at the bottom of every mock links to the sibling states of that screen.

## Cast and catalog

Reuse these in every mock. "Today" is **Wed 28 Oct 2026**.

| Who / what | Details |
|---|---|
| Buyer | Jordan Lee, jordan.lee@example.com, Visa ending 4242 |
| Mechanic | Dev Patel, licence 310S, Hamilton (412 inspections) |
| Body shop reviewer | Mira Okonkwo, Hamilton |
| Seller (Civic) | Sam Whitaker, 905-555-0142 |
| Car 1 | 2016 Honda Civic LX, 142,300 km, VIN 2HGFC2F59GH512345, asking $8,900, certify $1,180–$1,540, call Thu 29 Oct 6:30 PM, mechanic + body shop |
| Car 2 | 2014 Mazda3 GS, 171,900 km, asking $7,400, certify $620–$900, report ready (first booking, 21 Oct) |
| Car 3 | 2017 Toyota Corolla LE, 118,450 km, asking $9,600, certify $310–$480, report in progress (added 23 Oct) |
| Window | Opened Wed 21 Oct, closes Wed 4 Nov 2026 |
| Prices | $50 first car, $25 each additional car, +$20 when both reviews are chosen. The Civic is $25 + $20 = $45. |

## Design system

Taken from the supplied brand guide: IBM Plex Sans and Plex Mono, Asphalt `#14181F`, Paper `#F6F4EF`, Signal `#C9480B`, and the pass / caution / fail status colours. Tokens are in `assets/tokens.css` (the `--palette-blue-*` ramp holds the Signal orange so the shared kit works unchanged). New SecondLook components (logo and wordmark, status, review type selector, price panel, report, wizard, call stage, compare) are appended to `assets/ui.css`.

Fonts: the mocks name IBM Plex Sans and Plex Mono but do not load them from the network, so they open offline. Install the fonts locally to see them exactly; otherwise the system sans and monospace stack is used.

## Assumptions and open questions

- **Window length**: assumed 14 days from the first booking. The brief only says "the same window".
- **Body shop alone**: priced the same as a mechanic review ($0 add-on); only "both" adds $20, as in the supplied data.
- **Refund policy**: full refund if the seller doesn’t show or the buyer cancels more than 2 hours before the call; $25 retained later.
- **Region**: copy says "safety certified" (the Ontario term). For other provinces, "pass a safety inspection" travels better.
- **Report timing**: "within an hour of the call" is an assumption.
- **Call recordings**: kept 30 days, assumed.
- **Disclosure step**: added between Review and Schedule so the buyer agrees before a slot is held or a card is charged. The wording is plain-language product copy and needs counsel review; whether a liability waiver is enforceable in Ontario is a legal question, not a design one.
- **Photos and video**: the disclosure lists what the mechanic needs (photos, video with the engine running) but no upload step is mocked yet. Open question: does the buyer or the seller send them, and before or during the call?
- **Mechanic profile, share link (14 days)** and the compare view are additions beyond the brief.

## Checking

```sh
python .claude/skills/writing-html-mocks/scripts/check_mocks.py docs/mocks --write
python .claude/skills/writing-html-mocks/scripts/screenshot_mocks.py docs/mocks
```

The second command writes to `docs/mocks/.cache/` (git-ignored). The mocks are generated from a script kept outside the repo; edit the HTML and `assets/` directly from here on.

## Coverage

<!-- coverage:start -->

Legend: ✅ mock exists · ➖ not applicable (reason in manifest) · ❌ missing

### Pages

| Screen | default | loading | empty | error | invalid | submitting | success | long | edge | read-only | forbidden | offline | ended | partial | read | no-results | Requirements |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Home (`home`) | [✅](pages/home/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| How it works (`how-it-works`) | [✅](pages/how-it-works/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Pricing (`pricing`) | [✅](pages/pricing/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Mechanic profile (`mechanic-profile`) | [✅](pages/mechanic-profile/default.html) | [✅](pages/mechanic-profile/loading.html) | ➖ | [✅](pages/mechanic-profile/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Page not found (`not-found`) | [✅](pages/not-found/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| No access (`forbidden`) | [✅](pages/forbidden/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Something went wrong (`server-error`) | [✅](pages/server-error/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| You’re offline (`offline`) | [✅](pages/offline/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Down for maintenance (`maintenance`) | [✅](pages/maintenance/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Terms of service (`terms`) | [✅](pages/terms/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Privacy policy (`privacy`) | [✅](pages/privacy/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Sign in (`sign-in`) | [✅](pages/sign-in/default.html) | ➖ | ➖ | [✅](pages/sign-in/error.html) | [✅](pages/sign-in/invalid.html) | [✅](pages/sign-in/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Create account (`sign-up`) | [✅](pages/sign-up/default.html) | ➖ | ➖ | [✅](pages/sign-up/error.html) | [✅](pages/sign-up/invalid.html) | [✅](pages/sign-up/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Forgot password (`forgot-password`) | [✅](pages/forgot-password/default.html) | ➖ | ➖ | [✅](pages/forgot-password/error.html) | [✅](pages/forgot-password/invalid.html) | [✅](pages/forgot-password/submitting.html) | [✅](pages/forgot-password/success.html) |  |  |  |  |  |  |  |  |  |  |
| Choose a new password (`reset-password`) | [✅](pages/reset-password/default.html) | ➖ | ➖ | [✅](pages/reset-password/error.html) | [✅](pages/reset-password/invalid.html) | [✅](pages/reset-password/submitting.html) | [✅](pages/reset-password/success.html) |  |  |  |  |  |  |  |  |  |  |
| Verify your email (`verify-email`) | [✅](pages/verify-email/default.html) | [✅](pages/verify-email/loading.html) | ➖ | [✅](pages/verify-email/error.html) |  |  | [✅](pages/verify-email/success.html) |  |  |  |  |  |  |  |  |  |  |
| Your inspections (`dashboard`) | [✅](pages/dashboard/default.html) | [✅](pages/dashboard/loading.html) | [✅](pages/dashboard/empty.html) | [✅](pages/dashboard/error.html) |  |  |  | [✅](pages/dashboard/long.html) | [✅](pages/dashboard/edge.html) |  |  |  |  |  |  |  |  |
| Book: vehicle (`book-vehicle`) | [✅](pages/book-vehicle/default.html) | ➖ | ➖ | [✅](pages/book-vehicle/error.html) | [✅](pages/book-vehicle/invalid.html) | [✅](pages/book-vehicle/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Book: review type (`book-review-type`) | [✅](pages/book-review-type/default.html) | ➖ | ➖ | [✅](pages/book-review-type/error.html) |  | [✅](pages/book-review-type/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Book: disclosure (`book-disclosure`) | [✅](pages/book-disclosure/default.html) | ➖ | ➖ | [✅](pages/book-disclosure/error.html) | [✅](pages/book-disclosure/invalid.html) | [✅](pages/book-disclosure/submitting.html) |  |  |  |  |  |  |  |  |  |  | `L2-066`, `L2-067` |
| Book: schedule (`book-schedule`) | [✅](pages/book-schedule/default.html) | [✅](pages/book-schedule/loading.html) | [✅](pages/book-schedule/empty.html) | [✅](pages/book-schedule/error.html) |  | [✅](pages/book-schedule/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Book: pay (`checkout`) | [✅](pages/checkout/default.html) | ➖ | ➖ | [✅](pages/checkout/error.html) | [✅](pages/checkout/invalid.html) | [✅](pages/checkout/submitting.html) |  |  |  |  |  |  |  |  |  |  |  |
| Booking confirmed (`booking-confirmed`) | [✅](pages/booking-confirmed/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Inspection (`inspection-detail`) | [✅](pages/inspection-detail/default.html) | [✅](pages/inspection-detail/loading.html) | ➖ | [✅](pages/inspection-detail/error.html) |  |  |  |  |  | [✅](pages/inspection-detail/read-only.html) | [✅](pages/inspection-detail/forbidden.html) |  |  |  |  |  |  |
| Call lobby (`call-lobby`) | [✅](pages/call-lobby/default.html) | [✅](pages/call-lobby/loading.html) | ➖ | [✅](pages/call-lobby/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Live inspection (`live-inspection`) | [✅](pages/live-inspection/default.html) | [✅](pages/live-inspection/loading.html) | ➖ | [✅](pages/live-inspection/error.html) |  |  |  |  |  |  |  | [✅](pages/live-inspection/offline.html) | [✅](pages/live-inspection/ended.html) |  |  |  |  |
| Inspection report (`report`) | [✅](pages/report/default.html) | [✅](pages/report/loading.html) | ➖ | [✅](pages/report/error.html) |  |  |  |  | [✅](pages/report/edge.html) |  | [✅](pages/report/forbidden.html) |  |  | [✅](pages/report/partial.html) |  |  |  |
| Compare cars (`compare`) | [✅](pages/compare/default.html) | [✅](pages/compare/loading.html) | [✅](pages/compare/empty.html) | [✅](pages/compare/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Notifications (`notifications`) | [✅](pages/notifications/default.html) | [✅](pages/notifications/loading.html) | [✅](pages/notifications/empty.html) | [✅](pages/notifications/error.html) |  |  |  |  |  |  |  |  |  |  | [✅](pages/notifications/read.html) |  |  |
| Settings (`settings`) | [✅](pages/settings/default.html) | [✅](pages/settings/loading.html) | ➖ | [✅](pages/settings/error.html) | [✅](pages/settings/invalid.html) | [✅](pages/settings/submitting.html) | [✅](pages/settings/success.html) |  |  |  |  |  |  |  |  |  |  |
| Billing history (`billing-history`) | [✅](pages/billing-history/default.html) | [✅](pages/billing-history/loading.html) | [✅](pages/billing-history/empty.html) | [✅](pages/billing-history/error.html) |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Help (`help`) | [✅](pages/help/default.html) | ➖ | ➖ | ➖ |  |  |  |  |  |  |  |  |  |  |  | [✅](pages/help/no-results.html) |  |

### Dialogs

| Screen | default | busy | invalid | failed | success | confirm | Requirements |
|---|---|---|---|---|---|---|---|
| Add another car (`add-another-car`) | [✅](dialogs/add-another-car/default.html) | [✅](dialogs/add-another-car/busy.html) | [✅](dialogs/add-another-car/invalid.html) | [✅](dialogs/add-another-car/failed.html) |  |  |  |
| Cancel inspection (`cancel-inspection`) | [✅](dialogs/cancel-inspection/default.html) | [✅](dialogs/cancel-inspection/busy.html) | [✅](dialogs/cancel-inspection/invalid.html) | [✅](dialogs/cancel-inspection/failed.html) |  |  |  |
| Reschedule (`reschedule`) | [✅](dialogs/reschedule/default.html) | [✅](dialogs/reschedule/busy.html) | [✅](dialogs/reschedule/invalid.html) | [✅](dialogs/reschedule/failed.html) |  |  |  |
| Share report (`share-report`) | [✅](dialogs/share-report/default.html) | [✅](dialogs/share-report/busy.html) | [✅](dialogs/share-report/invalid.html) | [✅](dialogs/share-report/failed.html) | [✅](dialogs/share-report/success.html) |  |  |
| Download report (`download-report`) | [✅](dialogs/download-report/default.html) | [✅](dialogs/download-report/busy.html) | ➖ | [✅](dialogs/download-report/failed.html) |  |  |  |
| Report an issue (`report-issue`) | [✅](dialogs/report-issue/default.html) | [✅](dialogs/report-issue/busy.html) | [✅](dialogs/report-issue/invalid.html) | [✅](dialogs/report-issue/failed.html) | [✅](dialogs/report-issue/success.html) |  |  |
| Add payment method (`add-payment-method`) | [✅](dialogs/add-payment-method/default.html) | [✅](dialogs/add-payment-method/busy.html) | [✅](dialogs/add-payment-method/invalid.html) | [✅](dialogs/add-payment-method/failed.html) |  |  |  |
| Sign out (`sign-out`) | [✅](dialogs/sign-out/default.html) | [✅](dialogs/sign-out/busy.html) | ➖ |  |  |  |  |
| Delete account (`delete-account`) | [✅](dialogs/delete-account/default.html) | [✅](dialogs/delete-account/busy.html) | [✅](dialogs/delete-account/invalid.html) | [✅](dialogs/delete-account/failed.html) |  | [✅](dialogs/delete-account/confirm.html) |  |
| End call (`end-call`) | [✅](dialogs/end-call/default.html) | [✅](dialogs/end-call/busy.html) | ➖ |  |  |  |  |

### Notifications

| Screen | info | success | warning | danger | with-action | stacked | persistent | Requirements |
|---|---|---|---|---|---|---|---|---|
| Booking toast (`booking-toast`) | [✅](notifications/booking-toast/info.html) | [✅](notifications/booking-toast/success.html) | [✅](notifications/booking-toast/warning.html) | [✅](notifications/booking-toast/danger.html) | [✅](notifications/booking-toast/with-action.html) | [✅](notifications/booking-toast/stacked.html) |  |  |
| Call banner (`call-banner`) | [✅](notifications/call-banner/info.html) | [✅](notifications/call-banner/success.html) | [✅](notifications/call-banner/warning.html) | [✅](notifications/call-banner/danger.html) |  |  | [✅](notifications/call-banner/persistent.html) |  |
| Report ready (`report-ready`) | [✅](notifications/report-ready/info.html) | [✅](notifications/report-ready/success.html) | [✅](notifications/report-ready/warning.html) | [✅](notifications/report-ready/danger.html) | [✅](notifications/report-ready/with-action.html) |  |  |  |
| Window banner (`window-expiring`) | [✅](notifications/window-expiring/info.html) | [✅](notifications/window-expiring/success.html) | [✅](notifications/window-expiring/warning.html) | [✅](notifications/window-expiring/danger.html) |  |  | [✅](notifications/window-expiring/persistent.html) |  |
| Payment toast (`payment-failed`) | [✅](notifications/payment-failed/info.html) | [✅](notifications/payment-failed/success.html) | [✅](notifications/payment-failed/warning.html) | [✅](notifications/payment-failed/danger.html) | [✅](notifications/payment-failed/with-action.html) |  |  |  |
| Cookie consent (`cookie-consent`) | [✅](notifications/cookie-consent/info.html) | [✅](notifications/cookie-consent/success.html) | ➖ | ➖ |  |  |  |  |

<!-- coverage:end -->

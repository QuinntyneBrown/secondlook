# Three-year revenue projection

**As of:** 28 October 2026 · **Currency:** CAD · **Periods:** first three full 12-month operating years after launch

[Business plan](business-plan.md) · [Editable workbook](../../outputs/secondlook-business-plan-20261028/secondlook-three-year-projection.xlsx)

No actual customers, revenue, signed partner volumes or provider contracts were supplied. This forecast is a bottom-up planning model. It assumes the operator acts as principal and records the full service price, with provider payouts as costs; agent accounting would produce a different revenue presentation.

## Base revenue drivers

| Input / result                              |    Year 1 |    Year 2 |     Year 3 |
| ------------------------------------------- | --------: | --------: | ---------: |
| Average active referral partners            |        10 |        30 |         65 |
| Qualified referrals per partner per month   |        12 |        15 |         18 |
| Conversion to a paid first booking          |       30% |       33% |        35% |
| Partner paid windows                        |       432 |     1,782 |      4,914 |
| Direct qualified leads per month            |       120 |       300 |        700 |
| Direct conversion                           |       20% |       22% |        24% |
| Direct paid windows                         |       288 |       792 |      2,016 |
| **Total served paid windows**               |   **720** | **2,574** |  **6,930** |
| Additional inspections per window           |      0.40 |      0.50 |       0.60 |
| Additional inspection bookings              |       288 |     1,287 |      4,158 |
| **Total inspection bookings**               | **1,008** | **3,861** | **11,088** |
| Body-shop attachment across all inspections |       25% |       30% |        35% |
| Expected body-shop add-ons                  |     252.0 |   1,158.3 |    3,880.8 |

Fractional expected add-ons are appropriate for forecast mix; they are not fractional customer transactions. Average active partners account for activation and attrition over the year; do not multiply a year-end partner count by twelve months. Buyers are deduplicated across channels; a paid window is a buying episode, not necessarily a unique person across all three years.

## Revenue calculation

```text
Partner demand = round(average active partners × referrals/month × 12 × conversion × demand multiplier)
Direct demand = round(direct qualified leads/month × 12 × conversion × demand multiplier)
Minutes/window = first-review minutes
                 + additional inspections/window × additional-review minutes
                 + (1 + additional inspections/window) × add-on attachment × add-on minutes
Bookable hours = provider roster × offered hours/week × weeks/year × bookable share
Capacity windows = round down(bookable hours × 60 ÷ minutes/window)
Served windows = smaller of total demand and capacity windows
Additional inspections = round(served windows × additional inspections/window)
Total inspections = served windows + additional inspections
Expected add-ons = total inspections × attachment
Gross billings = served windows × $50 + additional inspections × $25 + add-ons × $20
Net revenue = gross billings × (1 − refund/credit allowance)
```

When capacity constrains demand, allocate served windows to partner and direct channels proportionally; round partner windows, then assign the remaining served windows to direct. No growth rate is applied to last year's revenue. Volumes drive growth through the stated acquisition and repeat-inspection assumptions.

| Revenue stream                |      Year 1 |       Year 2 |       Year 3 |
| ----------------------------- | ----------: | -----------: | -----------: |
| First inspections at $50      |     $36,000 |     $128,700 |     $346,500 |
| Additional inspections at $25 |      $7,200 |      $32,175 |     $103,950 |
| Body shop add-ons at $20      |      $5,040 |      $23,166 |      $77,616 |
| **Gross service billings**    | **$48,240** | **$184,041** | **$528,066** |
| Refunds / credits at 3%       |    ($1,447) |     ($5,521) |    ($15,842) |
| **Net service revenue**       | **$46,793** | **$178,520** | **$512,224** |

Prices and the 14-day pricing window are product requirements. Volume, conversion, repeat-inspection mix, attachment and refund assumptions are unvalidated planning inputs. The model excludes vehicle purchase value, sales tax, financing revenue, repair commissions, subscriptions, standalone body-shop services and safety-certificate issuance fees. Customer prepayments for future undelivered services are not additional forecast revenue.

## Costs and operating result

| Cost driver                                              |  Year 1 |  Year 2 |  Year 3 |
| -------------------------------------------------------- | ------: | ------: | ------: |
| Mechanic payout: first inspection                        |     $22 |     $22 |     $22 |
| Mechanic payout: additional inspection                   |     $15 |     $15 |     $15 |
| Body shop payout: add-on                                 |     $12 |     $12 |     $12 |
| Variable technology / support per inspection             |   $1.75 |   $1.75 |   $1.75 |
| Partner acquisition fee per served partner window        |      $5 |      $5 |      $5 |
| Blended direct acquisition cost per served direct window |     $12 |     $14 |     $16 |
| Founder cash compensation                                | $12,000 | $30,000 | $60,000 |
| Fixed operations payroll                                 |      $0 | $12,000 | $24,000 |
| Product / maintenance                                    | $12,000 | $18,000 | $24,000 |
| Insurance / professional review                          |  $4,800 |  $6,000 |  $8,000 |
| Administration / accounting                              |  $6,000 |  $8,000 | $10,000 |
| Fixed hosting / software                                 |  $2,400 |  $4,800 |  $7,200 |

Payment fees are 2.9% of gross customer charges including assumed 13% HST, plus $0.30 for each inspection payment. Add-ons are bundled into that payment. This uses the public [Stripe domestic-card rate](https://stripe.com/en-ca/pricing) and the [CRA Ontario rate](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-place-supply.html); transaction mix, registration and tax treatment need confirmation. No provider/processor fee recovery is assumed when revenue is refunded. Full provider and delivery costs are retained on modeled billings, making the refund treatment conservative.

Contribution after acquisition is net revenue minus provider payouts, payment fees, variable technology/support, partner fees and direct acquisition spend. Operating result subtracts fixed costs. Founder replacement expense is the positive difference between assumed $60,000 market compensation and founder cash compensation; it is displayed separately, not charged twice. Fixed payroll and external maintenance budgets are all-in planning allowances, not verified salary quotes.

Break-even windows equal annual fixed costs divided by that year's modeled contribution per served window, rounded up. It assumes the year's service and channel mix continues. Funding equals the largest cumulative annual pre-financing cash deficit to date plus the reserve; it is a lower-bound annual approximation, not a monthly cash plan.

## Workbook controls

The workbook opens on **Summary**. On **Assumptions**, change **D3** to 1 for Downside, 2 for Base, or 3 for Upside. Active demand multipliers in D5:F5 select 0.50×, 1.00× or 1.75× demand; individual future-year multipliers and operating drivers are editable in blue. Pricing, costs and capacity stay fixed unless edited explicitly. The same Forecast sheet recalculates every case, including capacity constraints and excess demand.

The workbook contains one live selected case. The case comparison in the business plan is a dated evaluation of those settings; it will not update automatically after workbook edits. Refresh that table when assumptions change. A larger provider roster in the upside case may also need more fixed coordination cost, which the demand-only comparison does not assume.

Key forecast formulas were checked against an independent calculation for all three cases. A Year 3 referral-productivity change was applied and restored to verify input propagation; formula-error scans passed. The summary and source-sheet layouts were rendered for visual review. Calculation was verified in the artifact spreadsheet engine; an interactive Excel application session was not used. Excel formulas and cached outputs are included for further editing.

## Update before launch

Replace the assumed partner cohort, qualified referral rate, conversion, add-on attachment and additional-car rate with pilot observations. Obtain agreed provider payouts, actual review durations, insurance quotes and payment/payout charges. Confirm referral compensation, principal/agent accounting, HST treatment, product completion costs and founder compensation. Add a monthly cash schedule for settlement timing, refunds, provider payouts, remittances, launch ramp and seasonality before setting a funding commitment.

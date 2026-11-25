# Customer payment rating

A read-only indicator of how reliably a customer pays instalments. It is derived from data that
already exists (instalment schedules and unreversed receipts); nobody types it. It is internal:
owner, administrator and seller see it, investors and the storefront never do. It warns and never
blocks a sale. A repeat-sale decision should not rest on the score alone.

Everything adjustable is in one place: `RATING` in `lib/customer-rating.ts`. The points and bands
are a starting model, to be tuned on real data.

## Levels (score 0 to 100)

| Level | Name | Score |
|---|---|---|
| A+ | Ideal mijoz | 90 to 100 |
| A | Yaxshi mijoz | 75 to 89 |
| B | O‘rtacha mijoz | 60 to 74 |
| C | Riskli mijoz | 40 to 59 |
| D | Yuqori riskli mijoz | 0 to 39 |

A customer with no instalment due yet has no level: "Yangi mijoz, tarix yo‘q".

## How the score is built (proposed, waiting for the owner's confirmation)

Only instalments whose due date has come (Asia/Tashkent date) count. Future instalments are neutral.
An instalment is paid on the day its receipts add up to its amount. Days late = that day minus the
due date; for an unpaid instalment, today minus the due date.

| Component | Max | Rule |
|---|---|---|
| Paid on time | 40 | share of due instalments paid within 3 days of the due date × 40 |
| Days late | 25 | by the worst delay in the history: 0 days 25, 1 to 3 days 22, 4 to 7 days 18, 8 to 15 days 12, 16 to 30 days 6, 31+ days 0 |
| Paid in full | 20 | money paid on due instalments ÷ money due × 20 |
| Earlier contracts | 15 | none closed yet 10; closed with no delay over 7 days 15; closed with delays 8; an instalment unpaid for more than 30 days 0 |

The whole history counts equally.

## One example per level (six instalments due)

| Customer | On time | Days late | In full | Contracts | Score | Level |
|---|---|---|---|---|---|---|
| All six on the date, one earlier contract closed well | 40 | 25 | 20 | 15 | 100 | A+ |
| First contract, one payment 5 days late | 33 | 18 | 20 | 10 | 81 | A |
| Two late, the worst by 12 days | 27 | 12 | 20 | 10 | 69 | B |
| Three late, the worst by 25 days | 20 | 6 | 20 | 10 | 56 | C |
| Last three unpaid, the oldest for 66 days | 13 | 0 | 10 | 0 | 23 | D |

These are the cases in `tests/customer-rating.test.mjs`.

## Open choices for the owner

1. The points per delay bucket and the 3-day grace period.
2. What a first-time customer gets for "earlier contracts": 10 of 15 is proposed, so a perfect first contract scores 95.
3. From when a customer stops being "new": after the first due instalment is proposed.
4. Whether recent months should weigh more than old ones: equal weight is proposed.

Not built, possible later modules: credit limits, portfolio at risk (PAR 7/15/30), early warning, collection management.

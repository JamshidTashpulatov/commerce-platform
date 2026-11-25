# Currency: whole US dollars

Every amount in the store is in **US dollars, whole dollars, no cents**. The decision was made on 2026-11-25. Everything people see uses one module, [`lib/money.ts`](../lib/money.ts):

| Export | Purpose |
|---|---|
| `CURRENCY` | `{code:"USD", symbol:"$"}` |
| `formatMoney(v)` | `"$1,250"`, comma thousands, no decimals, `"−$1,250"` for negatives, `"—"` for anything not an integer |
| `formatFrom(v)` | `"$1,250 dan"`, a starting price |
| `parseMoney(input)` | Input → digit string or `null`. Accepts `$1,250`, `1 250`, `1250.00`; at most 9 digits (`MONEY_MAX_DIGITS`) |
| `groupMoneyDigits(d)` | `"1,234,567"` for inputs that group while typing |

## Legacy `_uzs` names

Columns and API fields keep their old names (`variants.price_uzs`, `order_items.unit_price_uzs`, `amount_uzs`, `total_uzs`, and the rest). **The suffix is historical: the values are whole US dollars.** Stored integers and all arithmetic, including the finance and allocation maths, are unchanged, because they are integer and unit-agnostic. Renaming the columns and fields is a separate later change ([next steps](NEXT-STEPS.md)).

## Converting the demo prices

The catalog still holds the demo prices in so'm until Jamik gives the exchange rate and approves the run. [`scripts/convert-prices-to-usd.mjs`](../scripts/convert-prices-to-usd.mjs) converts them once:

```bash
DATABASE_URL=... STORE_ID=... node scripts/convert-prices-to-usd.mjs --rate=12650          # dry run, prints the plan
DATABASE_URL=... STORE_ID=... node scripts/convert-prices-to-usd.mjs --rate=12650 --apply  # writes
```

- `--rate` is so'm per one dollar (between 1,000 and 100,000).
- **Rounding rule.** dollars = so'm ÷ rate. A whole-dollar result is kept. Otherwise:
  - under $100, round to the nearest dollar (minimum $1);
  - from $100, round to the nearest $10 and take $1 off, so prices end in 9 and move by at most $6 ($803.40 → $799, $1,247.20 → $1,249).
- **Scope.** Only `variants.price_uzs` is converted. Option groups hold no price amounts (only an `affectsPrice` flag); the script checks this and lists any number it finds.
- **Runs once.** `--apply` records the audit event `catalog_prices_converted_to_usd` and refuses to run again. Each row is updated only if it still holds the price that was read. It also stops when the cheapest active price is under 10,000, since that already looks like dollars.
- **Other amounts.** It lists every other `*_uzs` column with amounts for the store and does not change them.

Tested on a copy of the local catalog: 475 variants converted, a second run refused, and a run with the marker removed refused on the dollar check.

Jamik gave the rate on 2026-11-25: **1 $ = 12 500 so'm** (`--rate=12500`). The dry run also prints the prices that needed rounding, with before and after, and the order lines with what the rate would give them. On the local catalog every one of the 475 variant prices divides exactly, so nothing is rounded.

### Order of the release

The live site must never show so'm numbers with a `$` sign, or dollar numbers as so'm. So the dollar display and the conversion go out together, in one maintenance window:

1. Jamik reviews the production dry run (`--rate=12500`, no `--apply`) and says yes.
2. Merge the dollar-display PR. Do not deploy it yet.
3. Run the script with `--apply` on production.
4. Immediately deploy the latest `origin/main`.
5. Check the home page, a product and the cart.

Between steps 3 and 4 the old site shows dollar numbers with "so‘m". Keep that gap to the minute or two the deploy takes, or switch checkout off (`WEBSITE_CHECKOUT_ENABLED`) for the window. If the deploy fails, the script's audit event shows the conversion ran; do not run it again.

### The two test orders in production

At the time of writing, production holds two test orders whose `order_items.unit_price_uzs` are in so'm. There are no capital events, receipts or other amounts. Options, for Jamik to choose before the conversion runs:

1. **Recommended: cancel them through the staff workspace and leave the rows as a so'm-era record.** They are test orders, nothing was paid, and cancelled orders do not enter any total.
2. Convert their `unit_price_uzs` with the same rate, by hand, in the same maintenance window, so every stored amount is in dollars.
3. Delete them. This is only possible if nothing references them, and it loses the audit trail.

The script does not do any of these on its own.

## Customer carts

Carts saved in a browser remember the price seen. After the conversion every saved line shows "Narx o‘zgardi" once with the new dollar price, and the customer confirms it. Nothing is ordered at an old price, because the server always quotes current prices.

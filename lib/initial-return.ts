// How an initial payment goes back to the investors who funded the product.
// The system decides the shares; nobody types them.
//
// Rule: each investor's cumulative return is the received initial money times their part of the
// funding, in whole dollars. The leftover dollars go one each to the largest fractional parts,
// ties to the smaller investor id (largest remainder). That keeps every investor within one dollar
// of the exact proportion, which is what the monthly posting requires, and adds up exactly.
export type ReturnFunding = { id: string; invested: bigint; returned: bigint };
const zero = BigInt(0);
const one = BigInt(1);

/**
 * Shares of the newest initial receipt.
 * `received` is all initial money counted so far, including this receipt;
 * `returned` is what each investor already got back from the earlier initial receipts.
 * A share is never negative: money already returned is not taken back here.
 */
export function initialReturnShares(received: bigint, funding: readonly ReturnFunding[]) {
  const funded = funding.reduce((n, f) => n + f.invested, zero);
  const before = funding.reduce((n, f) => n + f.returned, zero);
  if (!funding.length || new Set(funding.map(f => f.id)).size !== funding.length ||
      funding.some(f => f.invested <= zero || f.returned < zero || f.returned > f.invested) ||
      received < before || received > funded) throw new Error("INVALID_INITIAL_RETURN");
  const rows = funding.map(f => ({
    id: f.id, returned: f.returned,
    floor: received * f.invested / funded, remainder: received * f.invested % funded,
    target: zero,
  }));
  for (const r of rows) r.target = r.returned > r.floor ? r.returned : r.floor;
  let left = received - rows.reduce((n, r) => n + r.target, zero);
  const byRemainder = (a: typeof rows[number], b: typeof rows[number]) =>
    a.remainder === b.remainder ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.remainder > b.remainder ? -1 : 1;
  if (left >= zero) {
    // The usual case. One leftover dollar each, largest fractional part first.
    for (const r of rows.filter(r => r.remainder > zero && r.target === r.floor).sort(byRemainder)) {
      if (left === zero) break;
      r.target += one;
      left -= one;
    }
  } else {
    // Earlier returns were not proportional (typed by hand before this rule). Nothing is taken
    // back; the new money goes to the investors who are behind, in proportion to how far behind.
    for (const r of rows) r.target = r.returned;
    left = received - before;
    const behind = rows.map(r => ({ r, gap: r.floor > r.returned ? r.floor - r.returned : zero })).filter(x => x.gap > zero);
    const gaps = behind.reduce((n, x) => n + x.gap, zero);
    const parts = behind.map(x => ({ ...x, add: left * x.gap / gaps, remainder: left * x.gap % gaps }));
    let rest = left - parts.reduce((n, x) => n + x.add, zero);
    for (const x of [...parts].sort((a, b) => a.remainder === b.remainder ? (a.r.id < b.r.id ? -1 : 1) : a.remainder > b.remainder ? -1 : 1)) {
      if (rest === zero) break;
      x.add += one;
      rest -= one;
    }
    for (const x of parts) x.r.target += x.add;
    left = zero;
  }
  if (left !== zero) throw new Error("INVALID_INITIAL_RETURN");
  return rows.map(r => ({ id: r.id, total: r.target, share: r.target - r.returned }));
}

/**
 * True when every investor's initial return is within one dollar of their exact proportion
 * of `initial` (the initial money returned for a product that cost `cost`).
 */
export function initialReturnIsProportional(initial: bigint, cost: bigint, rows: readonly { invested: bigint; returned: bigint }[]) {
  return rows.every(r => {
    const discrepancy = r.returned * cost - initial * r.invested;
    return discrepancy < cost && discrepancy > -cost;
  });
}

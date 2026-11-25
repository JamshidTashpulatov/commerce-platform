export type FundingShare = { id: string; invested: bigint; initial: bigint };
const zero = BigInt(0);
const one = BigInt(1);

// Highest averages makes cumulative whole-UZS shares monotone even with three or more investors.
// Start at each lower quota, then assign fewer than one extra unit per participant on average.
function apportion(total: bigint, shares: readonly FundingShare[], capPrincipal: boolean) {
  const amounts = shares.map(() => zero);
  let active = shares.map((_, i) => i);
  let remaining = total;
  while (active.length && remaining > zero) {
    const weight = active.reduce((sum, i) => sum + shares[i].invested, zero);
    const capped = active.filter(i => capPrincipal &&
      remaining * shares[i].invested >= (shares[i].invested - shares[i].initial) * weight);
    if (capped.length) {
      for (const i of capped) {
        amounts[i] = shares[i].invested - shares[i].initial;
        remaining -= amounts[i];
      }
      active = active.filter(i => !capped.includes(i));
      continue;
    }
    for (const i of active) amounts[i] = remaining * shares[i].invested / weight;
    remaining -= active.reduce((sum, i) => sum + amounts[i], zero);
    while (remaining > zero) {
      let best: number | undefined;
      for (const i of active) {
        if (capPrincipal && amounts[i] === shares[i].invested - shares[i].initial) continue;
        if (best === undefined) { best = i; continue; }
        const difference = shares[i].invested * (amounts[best] + one)
          - shares[best].invested * (amounts[i] + one);
        if (difference > zero || (difference === zero && shares[i].id < shares[best].id)) best = i;
      }
      if (best === undefined) throw new Error("INVALID_PRINCIPAL_CAP");
      amounts[best] += one;
      remaining -= one;
    }
  }
  if (remaining !== zero) throw new Error("INCOMPLETE_FUNDING");
  return amounts;
}

export function cumulativeMonthlyShares(paid: bigint, principal: bigint, markup: bigint, shares: readonly FundingShare[]) {
  const total = principal + markup;
  if (principal <= zero || markup < zero || paid < zero || paid > total || !shares.length ||
      shares.some(s => s.invested <= zero || s.initial < zero || s.initial > s.invested) ||
      new Set(shares.map(s=>s.id)).size !== shares.length ||
      shares.reduce((sum,s) => sum + s.invested - s.initial, zero) !== principal) {
    throw new Error("INVALID_FUNDING");
  }
  const principalPaid = (paid * principal + total / BigInt(2)) / total;
  const capital = apportion(principalPaid, shares, true);
  const profit = apportion(paid - principalPaid, shares, false);
  return shares.map((s,i) => ({id:s.id, principal:capital[i], profit:profit[i]}));
}

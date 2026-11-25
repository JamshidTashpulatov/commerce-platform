export type SplitInvestor = { id: string; available: bigint };
export type EqualSplit = { shares: Record<string, string>; short: { id: string; share: bigint; missing: bigint }[] };

/**
 * Split `total` so'm equally between the given investors, in whole so'm.
 * The leftover so'm (total not divisible by the count) go one each to the first investors in the
 * order given, so the parts always add up to exactly `total` and the result never depends on chance.
 * Nothing is shifted between investors: if an equal share is more than someone has available, that
 * investor is reported in `short` with the missing amount and no shares are returned.
 */
export function equalSplit(total: bigint, investors: SplitInvestor[]): EqualSplit {
  const zero = BigInt(0);
  if (total <= zero || investors.length === 0) return { shares: {}, short: [] };
  const count = BigInt(investors.length);
  const base = total / count;
  const leftover = Number(total % count);
  const parts = investors.map((investor, index) => ({ ...investor, share: base + (index < leftover ? BigInt(1) : zero) }));
  const short = parts.filter(p => p.share > p.available).map(p => ({ id: p.id, share: p.share, missing: p.share - p.available }));
  if (short.length) return { shares: {}, short };
  return { shares: Object.fromEntries(parts.filter(p => p.share > zero).map(p => [p.id, p.share.toString()])), short: [] };
}

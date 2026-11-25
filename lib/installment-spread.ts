// One customer payment can cover more than the month it is recorded against.
// The chosen month is filled first; what is left goes to the other unpaid months in schedule order
// (when the earlier months are paid, that is simply the following months). Whole dollars.
export type SpreadRow = { id: string; sequence_no: number; balance: bigint };
export type SpreadPart = { id: string; sequence_no: number; amount: bigint };
const zero = BigInt(0);

/** Throws "MONTH_PAID" when the chosen month has no balance, "OVER_CONTRACT" when the amount exceeds everything still owed. */
export function spreadPayment(amount: bigint, rows: readonly SpreadRow[], selectedId: string): SpreadPart[] {
  const chosen = rows.find(r => r.id === selectedId);
  if (amount <= zero || !chosen || rows.some(r => r.balance < zero)) throw new Error("INVALID_PAYMENT");
  if (chosen.balance === zero) throw new Error("MONTH_PAID");
  if (amount > remainingBalance(rows)) throw new Error("OVER_CONTRACT");
  const order = [chosen, ...rows.filter(r => r.id !== selectedId).sort((a, b) => a.sequence_no - b.sequence_no)];
  const parts: SpreadPart[] = [];
  let left = amount;
  for (const r of order) {
    if (left === zero) break;
    const part = left < r.balance ? left : r.balance;
    if (part > zero) parts.push({ id: r.id, sequence_no: r.sequence_no, amount: part });
    left -= part;
  }
  return parts;
}
export const remainingBalance = (rows: readonly SpreadRow[]) => rows.reduce((n, r) => n + r.balance, zero);

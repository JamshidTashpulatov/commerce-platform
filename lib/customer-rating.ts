// Customer payment rating: a read-only indicator derived from instalment schedules and receipts.
// Nothing here is typed by hand, and the rating never blocks a sale: it only informs.
//
// Everything a business owner may want to change is in RATING below. The points and bands are a
// starting model, to be tuned on real data.
export const RATING = {
  /** Score bands, best first. */
  levels: [
    { key: "A+", name: "Ideal mijoz", min: 90 },
    { key: "A", name: "Yaxshi mijoz", min: 75 },
    { key: "B", name: "O‘rtacha mijoz", min: 60 },
    { key: "C", name: "Riskli mijoz", min: 40 },
    { key: "D", name: "Yuqori riskli mijoz", min: 0 },
  ],
  /** Maximum points of each component (100 in all). */
  points: { onTime: 40, delay: 25, paidInFull: 20, priorContracts: 15 },
  /** A payment this many days after its due date still counts as on time. */
  graceDays: 3,
  /** Days past due buckets, mildest first. `delayPoints` is what the worst bucket in the history earns. */
  buckets: [
    { key: "normal", name: "Normal", upTo: 0, delayPoints: 25 },
    { key: "small", name: "Kichik kechikish", upTo: 3, delayPoints: 22 },
    { key: "warning", name: "Ogohlantirish", upTo: 7, delayPoints: 18 },
    { key: "risky", name: "Riskli", upTo: 15, delayPoints: 12 },
    { key: "high", name: "Yuqori risk", upTo: 30, delayPoints: 6 },
    { key: "serious", name: "Jiddiy qarzdorlik", upTo: Infinity, delayPoints: 0 },
  ],
  /** Points for earlier contracts: none closed yet, all closed without a real delay, closed with delays, serious debt. */
  priorContracts: { none: 10, closedWell: 15, closedLate: 8, seriousDebt: 0 },
  /** A closed contract counts as closed well when its worst delay stayed within this many days. */
  closedWellWithinDays: 7,
} as const;

export type RatingRow = { due: string; amount: bigint; receipts: { date: string; amount: bigint }[] };
export type RatingContract = { status: string; rows: RatingRow[] };
export type InstalmentMark = { due: string; state: "on_time" | "late" | "overdue"; days: number };
export type CustomerRating = {
  /** null: a new customer with no instalment due yet. */
  level: { key: string; name: string } | null;
  score: number | null;
  parts: { onTime: number; delay: number; paidInFull: number; priorContracts: number } | null;
  contracts: number;
  activeContracts: number;
  closedContracts: number;
  due: number;
  onTime: number;
  late: number;
  overdue: number;
  overdueAmount: string;
  remainingDebt: string;
  averageDelayDays: number;
  worstDelayDays: number;
  worstBucket: string;
  oldestOverdueDays: number;
  recent: InstalmentMark[];
  /** The facts behind the level, in one Uzbek sentence. */
  reason: string;
};

const zero = BigInt(0);
const dayNumber = (date: string) => Math.round(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) / 86400000);
export const bucketFor = (days: number) => RATING.buckets.find(b => days <= b.upTo)!;

/**
 * `today` is the Asia/Tashkent date (YYYY-MM-DD). Receipts must already exclude reversed ones.
 * Instalments due in the future are neutral: they add to the remaining debt and to nothing else.
 */
export function rateCustomer(contracts: readonly RatingContract[], today: string): CustomerRating {
  const now = dayNumber(today);
  let due = 0, onTime = 0, late = 0, overdue = 0, delaySum = 0, worst = 0, oldestOverdue = 0;
  let overdueAmount = zero, remaining = zero, dueAmount = zero, paidOnDue = zero;
  let closedWell = 0, closedLate = 0;
  const marks: InstalmentMark[] = [];
  for (const contract of contracts) {
    let contractWorst = 0;
    for (const row of contract.rows) {
      const receipts = [...row.receipts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      const paid = receipts.reduce((n, r) => n + r.amount, zero);
      if (paid < row.amount) remaining += row.amount - paid;
      const dueDay = dayNumber(row.due);
      if (dueDay > now) continue;
      due++;
      dueAmount += row.amount;
      paidOnDue += paid < row.amount ? paid : row.amount;
      // The day the instalment became fully paid: the receipt that brought the total up to the amount.
      let running = zero, paidDay: number | null = null;
      for (const r of receipts) {
        running += r.amount;
        if (running >= row.amount) { paidDay = dayNumber(r.date); break; }
      }
      const days = Math.max(0, (paidDay ?? now) - dueDay);
      delaySum += days;
      if (days > worst) worst = days;
      if (days > contractWorst) contractWorst = days;
      if (paidDay === null) {
        overdue++;
        overdueAmount += row.amount - paid;
        if (days > oldestOverdue) oldestOverdue = days;
        marks.push({ due: row.due, state: "overdue", days });
      } else if (days <= RATING.graceDays) {
        onTime++;
        marks.push({ due: row.due, state: "on_time", days });
      } else {
        late++;
        marks.push({ due: row.due, state: "late", days });
      }
    }
    if (contract.status === "settled") contractWorst <= RATING.closedWellWithinDays ? closedWell++ : closedLate++;
  }
  marks.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  const base = {
    contracts: contracts.length,
    activeContracts: contracts.filter(c => c.status === "active").length,
    closedContracts: closedWell + closedLate,
    due, onTime, late, overdue,
    overdueAmount: overdueAmount.toString(), remainingDebt: remaining.toString(),
    averageDelayDays: due ? Math.round((delaySum / due) * 10) / 10 : 0,
    worstDelayDays: worst, worstBucket: bucketFor(worst).name, oldestOverdueDays: oldestOverdue,
    recent: marks.slice(-6),
  };
  if (!due) return { ...base, level: null, score: null, parts: null, reason: contracts.length ? "Yangi mijoz, tarix yo‘q: birinchi to‘lov muddati hali kelmagan." : "Yangi mijoz, tarix yo‘q." };
  const p = RATING.points;
  const parts = {
    onTime: Math.round((onTime / due) * p.onTime),
    delay: bucketFor(worst).delayPoints,
    paidInFull: Number((paidOnDue * BigInt(p.paidInFull * 100)) / dueAmount) / 100,
    priorContracts: worst > 30 && overdue > 0 ? RATING.priorContracts.seriousDebt : closedLate ? RATING.priorContracts.closedLate : closedWell ? RATING.priorContracts.closedWell : RATING.priorContracts.none,
  };
  parts.paidInFull = Math.round(parts.paidInFull);
  const score = Math.max(0, Math.min(100, parts.onTime + parts.delay + parts.paidInFull + parts.priorContracts));
  const level = RATING.levels.find(l => score >= l.min)!;
  const facts = [`${due} to‘lovdan ${onTime} tasi vaqtida`];
  if (late) facts.push(`${late} tasi kechikib to‘langan (eng ko‘pi ${Math.max(...marks.filter(m => m.state === "late").map(m => m.days))} kun)`);
  if (overdue) facts.push(`${overdue} tasi hozir to‘lanmagan (eng eskisi ${oldestOverdue} kun)`);
  if (base.closedContracts) facts.push(`${base.closedContracts} ta shartnoma yopilgan`);
  return { ...base, level: { key: level.key, name: level.name }, score, parts, reason: facts.join(", ") + "." };
}

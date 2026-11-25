import "server-only";
import type { PoolClient } from "pg";
import { cumulativeMonthlyShares } from "../monthly-allocation";

// Caller holds the order lock for the entire receipt transaction.
export async function postMonthlyAllocation(c: PoolClient, store: string, order: string, receipt: string, amount: bigint) {
  const terms = (await c.query(
    "SELECT financed_principal_uzs,markup_uzs,cost_uzs FROM order_payment_terms WHERE store_id=$1 AND order_id=$2",
    [store,order]
  )).rows[0];
  const participants = (await c.query(`
    SELECT w.investor_account_id, w.invested_uzs, b.returned_uzs,
      COALESCE(SUM(a.principal_uzs),0) AS prior_capital, COALESCE(SUM(a.profit_uzs),0) AS prior_profit
    FROM installment_receipt_funding_weights w JOIN investor_funding_balances b
      ON b.store_id=w.store_id AND b.order_id=$2 AND b.investor_account_id=w.investor_account_id
    LEFT JOIN active_monthly_allocations a ON a.store_id=b.store_id AND a.order_id=b.order_id
      AND a.investor_account_id=b.investor_account_id
    WHERE w.store_id=$1 AND w.receipt_id=$3 GROUP BY w.investor_account_id,w.invested_uzs,b.returned_uzs
    ORDER BY w.investor_account_id`,[store,order,receipt])).rows;
  if (!terms?.financed_principal_uzs || !participants.length) return "Avval sotuvni va to‘liq moliyalashtirishni tasdiqlang";
  const shares = participants.map(r=>({id:String(r.investor_account_id),invested:BigInt(r.invested_uzs),
    initial:BigInt(r.returned_uzs)-BigInt(r.prior_capital)}));
  const principal = BigInt(terms.financed_principal_uzs);
  const cost = BigInt(terms.cost_uzs);
  if (shares.reduce((sum,s)=>sum+s.invested-s.initial,BigInt(0)) !== principal) return "Boshlang‘ich kapital qaytimini to‘liq taqsimlang";
  // An earlier manually posted, materially nonproportional return needs reconciliation.
  if (shares.some(s=>{
    const discrepancy = s.initial*cost - (cost-principal)*s.invested;
    return discrepancy >= cost || discrepancy <= -cost;
  })) return "Boshlang‘ich qaytim ulushlarini moliyalashtirish bilan solishtiring";
  const prior = participants.reduce((sum,r)=>sum+BigInt(r.prior_capital)+BigInt(r.prior_profit),BigInt(0));
  const received = await c.query(`SELECT COALESCE(SUM(r.amount_uzs),0) AS total FROM installment_receipts r
    JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id
    JOIN installment_contracts k ON k.store_id=s.store_id AND k.id=s.contract_id
    WHERE k.store_id=$1 AND k.order_id=$2 AND NOT EXISTS
      (SELECT 1 FROM installment_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.id)`,[store,order]);
  if (BigInt(received.rows[0].total)!==prior+amount) return "Oldingi oylik tushumlar taqsimotini solishtiring";
  const targets = cumulativeMonthlyShares(prior+amount,principal,BigInt(terms.markup_uzs),shares);
  for (const [i,target] of targets.entries()) {
    await c.query(`INSERT INTO investor_monthly_allocations
      (store_id,order_id,receipt_id,investor_account_id,principal_uzs,profit_uzs)
      VALUES($1,$2,$3,$4,$5,$6)`,[store,order,receipt,target.id,
      (target.principal-BigInt(participants[i].prior_capital)).toString(),
      (target.profit-BigInt(participants[i].prior_profit)).toString()]);
  }
  return null;
}

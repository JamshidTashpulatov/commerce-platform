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

// The order and investor membership locks are held until commit. The reversal is provisional.
export async function validateMonthlyReversal(c:PoolClient,store:string,order:string,receipt:string){
  const affected=await c.query(`SELECT m.account_id FROM memberships m JOIN investor_monthly_allocations a
    ON a.store_id=m.store_id AND a.investor_account_id=m.account_id
    WHERE a.store_id=$1 AND a.receipt_id=$2 ORDER BY m.account_id FOR UPDATE OF m`,[store,receipt]);
  if(!affected.rowCount)return null;
  const rows=(await c.query(`SELECT a.investor_account_id AS id,b.amount_uzs AS invested,b.returned_uzs,
      t.financed_principal_uzs,t.markup_uzs, credits.capital,credits.profit,
      (SELECT COALESCE(SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END),0)
         FROM investor_capital_events WHERE store_id=a.store_id AND investor_account_id=a.investor_account_id)
      -(SELECT SUM(outstanding_uzs) FROM investor_funding_balances WHERE store_id=a.store_id AND investor_account_id=a.investor_account_id) AS free,
      a.profit_uzs>0 AND EXISTS(SELECT 1 FROM investor_capital_events WHERE store_id=a.store_id
        AND investor_account_id=a.investor_account_id AND event_type='distribution') AS distribution_needs_review
    FROM investor_monthly_allocations a JOIN investor_funding_balances b USING(store_id,order_id,investor_account_id)
    JOIN order_payment_terms t USING(store_id,order_id)
    CROSS JOIN LATERAL(SELECT COALESCE(SUM(principal_uzs),0) AS capital,COALESCE(SUM(profit_uzs),0) AS profit
      FROM active_monthly_allocations WHERE store_id=a.store_id AND order_id=a.order_id AND investor_account_id=a.investor_account_id) credits
    WHERE a.store_id=$1 AND a.order_id=$2 AND a.receipt_id=$3 ORDER BY a.investor_account_id`,[store,order,receipt])).rows;
  if(rows.some(r=>BigInt(r.free)<BigInt(0)))return "Bo‘sh kapital yetarli emas. Tafovut oching.";
  if(rows.some(r=>r.distribution_needs_review))return "Investorga foyda berilgan. To‘lov manbasini solishtirish uchun tafovut oching.";
  const paid=rows.reduce((n,r)=>n+BigInt(r.capital)+BigInt(r.profit),BigInt(0));
  const targets=cumulativeMonthlyShares(paid,BigInt(rows[0].financed_principal_uzs),BigInt(rows[0].markup_uzs),
    rows.map(r=>({id:r.id,invested:BigInt(r.invested),initial:BigInt(r.returned_uzs)-BigInt(r.capital)})));
  if(targets.some((t,i)=>t.principal!==BigInt(rows[i].capital)||t.profit!==BigInt(rows[i].profit)))
    return "Keyingi tushumlarning ulushlari ham o‘zgaradi. Solishtirish uchun tafovut oching.";
  return null;
}

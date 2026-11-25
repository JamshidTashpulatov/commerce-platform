import { NextResponse } from "next/server";
import { database,configuredStoreId } from "../../../../lib/server/db";
import { requireStoreRole } from "../../../../lib/server/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
  try{
    const storeId=configuredStoreId();
    if(!await requireStoreRole(storeId,["owner","admin"]))return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers});
    const {rows}=await database().query(`
      WITH schedules AS (
        SELECT s.id,s.amount_uzs,s.due_date,COALESCE(SUM(r.amount_uzs) FILTER(WHERE v.receipt_id IS NULL),0) AS received
        FROM installment_schedule s
        JOIN installment_contracts c ON c.store_id=s.store_id AND c.id=s.contract_id
        LEFT JOIN installment_receipts r ON r.store_id=s.store_id AND r.schedule_id=s.id
        LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id
        WHERE s.store_id=$1 AND c.status='active' GROUP BY s.id
      ), invoices AS (
        SELECT i.id,i.amount_uzs,i.paid_uzs AS paid FROM supplier_invoice_balances i WHERE i.store_id=$1
      )
      SELECT
      COALESCE((SELECT SUM(amount_uzs-received) FROM schedules),0)::text AS installment_schedule_balance_uzs,
      COALESCE((SELECT SUM(amount_uzs-received) FROM schedules WHERE due_date < (now() AT TIME ZONE 'Asia/Tashkent')::date AND amount_uzs>received),0)::text AS overdue_schedule_balance_uzs,
      COALESCE((SELECT SUM(amount_uzs-paid) FROM invoices),0)::text AS supplier_invoice_balance_uzs,
      COALESCE((SELECT SUM(r.amount_uzs) FROM installment_receipts r LEFT JOIN installment_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND v.receipt_id IS NULL),0)::text AS scheduled_receipts_uzs,
      COALESCE((SELECT SUM(r.amount_uzs) FROM order_manual_receipts r LEFT JOIN order_receipt_reversals v ON v.store_id=r.store_id AND v.receipt_id=r.id WHERE r.store_id=$1 AND v.receipt_id IS NULL),0)::text AS manual_receipts_uzs,
      COALESCE((SELECT SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END) FROM investor_capital_events WHERE store_id=$1),0)::text AS net_contributed_capital_uzs,
      COALESCE((SELECT SUM(amount_uzs) FROM investor_funding_balances WHERE store_id=$1),0)::text AS allocated_principal_uzs,
      COALESCE((SELECT SUM(returned_uzs) FROM investor_funding_balances WHERE store_id=$1),0)::text AS returned_principal_uzs,
      COALESCE((SELECT SUM(outstanding_uzs) FROM investor_funding_balances WHERE store_id=$1),0)::text AS outstanding_principal_uzs,
      (COALESCE((SELECT SUM(CASE event_type WHEN 'contribution' THEN amount_uzs WHEN 'withdrawal' THEN -amount_uzs ELSE 0 END) FROM investor_capital_events WHERE store_id=$1),0)-COALESCE((SELECT SUM(outstanding_uzs) FROM investor_funding_balances WHERE store_id=$1),0))::text AS available_principal_uzs,
      COALESCE((SELECT SUM(amount_uzs) FROM investor_capital_events WHERE store_id=$1 AND event_type='distribution'),0)::text AS recorded_distributions_uzs,
      COALESCE((SELECT SUM(amount_uzs) FROM recorded_fund_movements WHERE store_id=$1),0)::text AS recorded_fund_net_uzs
    `,[storeId]);
    return NextResponse.json({currency:"USD",...rows[0]},{headers});
  }catch{return NextResponse.json({error:"Xizmat vaqtincha ishlamayapti"},{status:503,headers});}
}

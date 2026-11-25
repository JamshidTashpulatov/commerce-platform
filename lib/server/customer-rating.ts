import "server-only";
import type {Pool,PoolClient} from "pg";
import {rateCustomer,type CustomerRating,type RatingContract} from "../customer-rating";

/**
 * Ratings of the given customers (or of every customer when `ids` is null), computed from their
 * instalment schedules and unreversed receipts. Read-only. The date is the Asia/Tashkent date.
 * Customers without any contract are not in the map: the caller treats them as new.
 */
export async function customerRatings(db:Pool|PoolClient,store:string,ids:string[]|null):Promise<{today:string;ratings:Map<string,CustomerRating>}>{
 const today=(await db.query("SELECT ((now() AT TIME ZONE 'Asia/Tashkent')::date)::text AS d")).rows[0].d as string;
 const rows=(await db.query(`
  SELECT o.customer_record_id AS customer_id,k.id AS contract_id,k.status,s.due_date::text AS due,s.amount_uzs::text AS amount,
   COALESCE((SELECT json_agg(json_build_object('date',COALESCE(r.received_on,(r.received_at AT TIME ZONE 'Asia/Tashkent')::date)::text,'amount',r.amount_uzs::text))
     FROM installment_receipts r WHERE r.store_id=s.store_id AND r.schedule_id=s.id
      AND NOT EXISTS(SELECT 1 FROM installment_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.id)),'[]'::json) AS receipts
  FROM installment_contracts k
  JOIN orders o ON o.store_id=k.store_id AND o.id=k.order_id
  JOIN installment_schedule s ON s.store_id=k.store_id AND s.contract_id=k.id
  WHERE k.store_id=$1 AND k.status IN ('active','settled') AND o.customer_record_id IS NOT NULL
   AND ($2::uuid[] IS NULL OR o.customer_record_id=ANY($2::uuid[]))
  ORDER BY o.customer_record_id,k.created_at,k.id,s.sequence_no`,[store,ids])).rows;
 const byCustomer=new Map<string,Map<string,RatingContract>>();
 for(const r of rows){
  const contracts=byCustomer.get(r.customer_id)??new Map<string,RatingContract>();
  byCustomer.set(r.customer_id,contracts);
  const contract=contracts.get(r.contract_id)??{status:r.status as string,rows:[]};
  contracts.set(r.contract_id,contract);
  contract.rows.push({due:r.due,amount:BigInt(r.amount),receipts:(r.receipts as {date:string;amount:string}[]).map(x=>({date:x.date,amount:BigInt(x.amount)}))});
 }
 const ratings=new Map<string,CustomerRating>();
 for(const [customer,contracts] of byCustomer)ratings.set(customer,rateCustomer([...contracts.values()],today));
 return {today,ratings};
}
export const newCustomerRating=(today:string)=>rateCustomer([],today);

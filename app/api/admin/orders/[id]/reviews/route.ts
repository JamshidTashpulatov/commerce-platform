import {NextResponse} from "next/server";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {isUuid,smallJson,sameOrigin,privateHeaders} from "../../../../../../lib/server/http";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:privateHeaders});
type Context={params:Promise<{id:string}>};
export async function POST(request:Request,{params}:Context){
  if(!sameOrigin(request))return reply({error:"Ruxsat yo‘q"},403);
  const {id}=await params;
  const b=await smallJson(request);
  if(!isUuid(id)||!b||(b.action==="resolve"?!isUuid(b.reviewId):(!isUuid(b.receiptId)||!["monthly","manual"].includes(String(b.kind))))||
     typeof b.reason!=="string"||b.reason.trim().length<3||b.reason.length>240)return reply({error:"To‘lov va sababni tekshiring"},400);
  try{
    const store=configuredStoreId();
    const actor=await requireStoreRole(store,["owner","admin"]);
    if(!actor)return reply({error:"Ruxsat yo‘q"},403);
    const c=await database().connect();
    try{
      await c.query("BEGIN");
      await c.query("SELECT id FROM orders WHERE store_id=$1 AND id=$2 FOR UPDATE",[store,id]);
      if(b.action==="resolve"){
        const done=await c.query(`UPDATE receipt_reviews SET resolved_by=$4,resolved_at=now(),resolution=$5
          WHERE store_id=$1 AND order_id=$2 AND id=$3 AND resolved_at IS NULL RETURNING id`,
          [store,id,b.reviewId,actor.account_id,b.reason.trim()]);
        await c.query("COMMIT");
        return done.rowCount?reply({resolved:true}):reply({error:"Ochiq tafovut topilmadi"},409);
      }
      const monthly=b.kind==="monthly";
      const source=monthly?
        `SELECT r.id FROM installment_receipts r JOIN installment_schedule s ON s.store_id=r.store_id AND s.id=r.schedule_id
         JOIN installment_contracts k ON k.store_id=s.store_id AND k.id=s.contract_id WHERE r.store_id=$1 AND k.order_id=$2 AND r.id=$3
         AND NOT EXISTS(SELECT 1 FROM installment_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.id)`:
        `SELECT r.id FROM order_manual_receipts r WHERE r.store_id=$1 AND r.order_id=$2 AND r.id=$3
         AND NOT EXISTS(SELECT 1 FROM order_receipt_reversals v WHERE v.store_id=r.store_id AND v.receipt_id=r.id)`;
      const receipt=await c.query(source,[store,id,b.receiptId]);
      if(!receipt.rowCount){await c.query("ROLLBACK");return reply({error:"Amaldagi to‘lov topilmadi"},404);}
      const created=await c.query(`INSERT INTO receipt_reviews(store_id,order_id,monthly_id,manual_id,opened_by,reason)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
        [store,id,monthly?b.receiptId:null,monthly?null:b.receiptId,actor.account_id,b.reason.trim()]);
      await c.query("COMMIT");
      return reply({opened:!!created.rowCount},created.rowCount?201:200);
    }catch{await c.query("ROLLBACK");throw new Error("REVIEW_FAILED");}finally{c.release();}
  }catch{return reply({error:"Tafovutni saqlab bo‘lmadi"},503);}
}

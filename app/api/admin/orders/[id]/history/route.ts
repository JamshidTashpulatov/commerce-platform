import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../../../lib/server/http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
type Ctx={params:Promise<{id:string}>};

// Read-only: what was done on this order, newest first. Only the action, the actor's role and the time.
export async function GET(_request:Request,{params}:Ctx){
 try{
 const {id}=await params;if(!isUuid(id))return reply({error:"Buyurtma topilmadi"},404);
 const store=configuredStoreId();const viewer=await requireStoreRole(store,["owner","admin","seller"]);if(!viewer)return reply({error:"Ruxsat yo‘q"},403);
 const found=await database().query("SELECT 1 FROM orders WHERE store_id=$1 AND id=$2",[store,id]);
 if(!found.rowCount)return reply({error:"Buyurtma topilmadi"},404);
 const events=await database().query(`SELECT e.id,e.action,e.created_at,m.role AS actor_role
  FROM audit_events e LEFT JOIN memberships m ON m.store_id=e.store_id AND m.account_id=e.actor_id
  WHERE e.store_id=$1 AND e.entity_type='order' AND e.entity_id=$2 ORDER BY e.created_at DESC,e.id LIMIT 100`,[store,id]);
 return reply({events:events.rows});
 }catch{return reply({error:"Tarixni yuklab bo‘lmadi"},503);}
}

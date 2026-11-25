import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../../../lib/server/db";
import {requireStoreRole} from "../../../../../lib/server/auth";
import {isUuid,privateHeaders} from "../../../../../lib/server/http";
import {customerConfig,customerSummary} from "../../../../../lib/server/customers";
import {customerRatings,newCustomerRating} from "../../../../../lib/server/customer-rating";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});

// Internal indicator for staff (owner, admin, seller). Investors and the storefront never read it.
// `?id=` returns one customer's rating; without it, every customer with their rating.
export async function GET(request:Request){
 try{
 const store=configuredStoreId();if(!await requireStoreRole(store,["owner","admin","seller"]))return reply({error:"Ruxsat yo‘q"},403);
 const id=new URL(request.url).searchParams.get("id");
 if(id!==null&&!isUuid(id))return reply({error:"Mijoz topilmadi"},404);
 const keys=customerConfig();
 const db=database();
 const found=await db.query("SELECT id,name_cipher,phone_cipher,passport_cipher IS NOT NULL AS has_passport FROM customers WHERE store_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY created_at DESC,id LIMIT 1001",[store,id]);
 if(id!==null&&!found.rowCount)return reply({error:"Mijoz topilmadi"},404);
 const {today,ratings}=await customerRatings(db,store,id===null?null:[id]);
 const customers=found.rows.slice(0,1000).map(row=>({...customerSummary(row,store,keys.encryption),rating:ratings.get(row.id)??newCustomerRating(today)}));
 return id===null?reply({today,customers,truncated:found.rows.length>1000}):reply({today,customer:customers[0]});
 }catch{return reply({error:"Mijozlar moduli sozlanmagan yoki vaqtincha ishlamayapti"},503);}
}

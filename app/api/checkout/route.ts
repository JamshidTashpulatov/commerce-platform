import {NextResponse} from "next/server";
import {configuredStoreId} from "../../../lib/server/db";
import {privateHeaders,sameOrigin,smallJson} from "../../../lib/server/http";
import {checkoutEnabled,clientAddress,parseCheckout,submitCheckout} from "../../../lib/server/checkout";
import {currentCustomer} from "../../../lib/server/customer-session";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});

// Public guest checkout for the cart and one-click purchase. The response never
// echoes the customer's name or phone.
export async function POST(request:Request){
  if(!checkoutEnabled())return response({error:"Saytdan buyurtma hozircha o‘chirilgan. Telegram orqali yozing.",code:"disabled"},503);
  if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
  const input=parseCheckout(await smallJson(request));
  if(!input)return response({error:"Ma’lumotlarni tekshiring"},400);
  try{
    const storeId=configuredStoreId();
    const customer=await currentCustomer(storeId).catch(()=>null);
    if(input.useTelegramPhone&&!customer?.phone)return response({error:"Telefon raqamini kiriting"},400);
    const result=await submitCheckout(input,clientAddress(request),customer?{accountId:customer.accountId,phone:customer.phone}:null);
    return response(result.body,result.status);
  }catch{return response({error:"Buyurtma vaqtincha qabul qilinmadi"},503);}
}

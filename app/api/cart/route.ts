import {NextResponse} from "next/server";
import {database,configuredStoreId} from "../../../lib/server/db";
import {privateHeaders,sameOrigin,smallJson} from "../../../lib/server/http";
import {parseLines,quoteLines} from "../../../lib/server/cart";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});

// Read-only: re-prices a cart from the database. Prices in the browser are never trusted.
export async function POST(request:Request){
  if(!sameOrigin(request))return response({error:"Ruxsat yo‘q"},403);
  const body=await smallJson(request);
  const lines=parseLines(body?.lines);
  if(!lines)return response({error:"Savatni tekshiring"},400);
  try{return response({lines:await quoteLines(database(),configuredStoreId(),lines)});}
  catch{return response({error:"Savat vaqtincha yangilanmadi"},503);}
}

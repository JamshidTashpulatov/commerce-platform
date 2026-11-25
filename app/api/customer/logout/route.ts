import {NextResponse,type NextRequest} from "next/server";
import {createHash} from "node:crypto";
import {database} from "../../../../lib/server/db";
import {privateHeaders,sameOrigin} from "../../../../lib/server/http";
import {customerCookie} from "../../../../lib/server/customer-session";
export const runtime="nodejs";

export async function POST(request:NextRequest){
  if(!sameOrigin(request))return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers:privateHeaders});
  const token=request.cookies.get(customerCookie)?.value;
  if(token&&/^[A-Za-z0-9_-]{43}$/.test(token)){
    await database().query("UPDATE customer_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL",[createHash("sha256").update(token).digest("hex")]).catch(()=>{});
  }
  const response=NextResponse.json({ok:true},{headers:privateHeaders});
  response.cookies.delete(customerCookie);
  return response;
}

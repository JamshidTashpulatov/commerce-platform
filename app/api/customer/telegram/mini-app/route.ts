import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {verifyMiniApp} from "../../../../../lib/server/telegram-verify";
import {privateHeaders,sameOrigin,smallJson} from "../../../../../lib/server/http";
import {customerCookie,customerCookieOptions} from "../../../../../lib/server/customer-session";
import {openSession} from "../../../../../lib/server/telegram-oidc";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// Inside the Telegram Mini App the customer is already identified by signed
// launch data, so no second login step: verify it and open a customer session.
// The replay key differs from the staff login's, so both can use the same launch.
export async function POST(request:Request){
  const botToken=process.env.TELEGRAM_BOT_TOKEN;
  if(!botToken)return NextResponse.json({error:"Unavailable"},{status:503,headers:privateHeaders});
  if(!sameOrigin(request))return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers:privateHeaders});
  const body=await smallJson(request);
  const initData=typeof body?.initData==="string"?body.initData:"";
  const verified=verifyMiniApp(initData,botToken);
  if(!verified)return NextResponse.json({error:"Ruxsat yo‘q"},{status:403,headers:privateHeaders});
  let name:string|null=null;
  try{
    const user=JSON.parse(new URLSearchParams(initData).get("user")??"{}");
    name=[user.first_name,user.last_name].filter((v:unknown)=>typeof v==="string"&&v.trim()).join(" ").slice(0,80)||null;
  }catch{name=null;}
  const assertion=createHash("sha256").update("customer:"+verified.hash).digest("hex");
  try{
    const session=await openSession(verified.telegramUserId,name,null,assertion,verified.expiresAt);
    if(!session)return NextResponse.json({error:"Kirish allaqachon ishlatilgan"},{status:409,headers:privateHeaders});
    const response=NextResponse.json({ok:true},{headers:privateHeaders});
    response.cookies.set(customerCookie,session.token,{...customerCookieOptions,maxAge:session.maxAge});
    return response;
  }catch{return NextResponse.json({error:"Unavailable"},{status:503,headers:privateHeaders});}
}

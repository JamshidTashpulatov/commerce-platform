import {NextResponse,type NextRequest} from "next/server";
import {customerCookie,customerCookieOptions} from "../../../../../lib/server/customer-session";
import {finishLogin,loginCookie,safeNext} from "../../../../../lib/server/telegram-oidc";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  const params=request.nextUrl.searchParams;
  const origin=process.env.APP_ORIGIN??request.nextUrl.origin;
  const cookie=request.cookies.get(loginCookie)?.value;
  let next="/checkout";
  try{next=safeNext(JSON.parse(Buffer.from(cookie??"","base64url").toString("utf8")).next);}catch{/* default */}
  const back=(flag:string)=>new URL(next+(next.includes("?")?"&":"?")+"tg="+flag,origin);
  let result=null;
  try{
    const code=params.get("code"),state=params.get("state");
    if(code&&state&&!params.get("error"))result=await finishLogin(code,state,cookie);
  }catch{result=null;}
  const response=NextResponse.redirect(result?back("ok"):back("error"));
  response.cookies.delete(loginCookie);
  if(result)response.cookies.set(customerCookie,result.token,{...customerCookieOptions,maxAge:result.maxAge});
  response.headers.set("Cache-Control","no-store");
  return response;
}

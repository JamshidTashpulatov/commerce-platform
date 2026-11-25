import {NextResponse} from "next/server";
import {beginLogin,loginCookie,safeNext} from "../../../../../lib/server/telegram-oidc";
export const runtime="nodejs";
export const dynamic="force-dynamic";

// Starts Telegram Login (OIDC, authorization code with PKCE).
export async function GET(request:Request){
  const next=safeNext(new URL(request.url).searchParams.get("next"));
  const begin=beginLogin(next);
  const origin=process.env.APP_ORIGIN??new URL(request.url).origin;
  if(!begin)return NextResponse.redirect(new URL(next+(next.includes("?")?"&":"?")+"tg=off",origin));
  const response=NextResponse.redirect(begin.url);
  response.cookies.set(loginCookie,begin.cookie,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:600});
  response.headers.set("Cache-Control","no-store");
  return response;
}

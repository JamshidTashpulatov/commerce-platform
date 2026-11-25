import { NextRequest,NextResponse } from "next/server";
import { randomBytes,createHash } from "node:crypto";
import { database,configuredStoreId } from "../../../../lib/server/db";
import { verifyMiniApp } from "../../../../lib/server/telegram-verify";
import {cookieOptions,sessionCookie} from "../../../../lib/server/auth";
import {sameOrigin,privateHeaders} from "../../../../lib/server/http";
export const runtime="nodejs";
export async function POST(request:NextRequest){
  const botToken=process.env.TELEGRAM_BOT_TOKEN;
  const origin=process.env.APP_ORIGIN;
  if(!botToken||!origin)return NextResponse.json({error:"Authentication unavailable"},{status:503});
  if(!sameOrigin(request))return NextResponse.json({error:"Access denied"},{status:403});
  const reader=request.body?.getReader();
  if(!reader)return NextResponse.json({error:"Invalid request"},{status:400});
  let size=0;const chunks:Uint8Array[]=[];
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return NextResponse.json({error:"Request too large"},{status:413});}chunks.push(value);}
    let body;
    try { body=JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({error:"Invalid request"},{status:400,headers:privateHeaders}); }
    const verified=typeof body?.initData==="string"?verifyMiniApp(body.initData,botToken):null;
    if(!verified)return NextResponse.json({error:"Access denied"},{status:403});
    const storeId=configuredStoreId();
    const client=await database().connect();
    try{
      await client.query("BEGIN");
      const {rows}=await client.query("SELECT a.id,m.role FROM accounts a JOIN memberships m ON m.account_id=a.id WHERE a.telegram_user_id=$1 AND m.store_id=$2 AND m.role IN ('seller','investor')",[verified.telegramUserId,storeId]);
      if(!rows.length){await client.query("ROLLBACK");return NextResponse.json({error:"Access denied"},{status:403});}
      const assertion=await client.query("INSERT INTO telegram_auth_assertions(assertion_hash,expires_at) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING assertion_hash",[verified.hash,verified.expiresAt]);
      if(!assertion.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Login already used"},{status:409});}
      const token=randomBytes(32).toString("base64url");
      const tokenHash=createHash("sha256").update(token).digest("hex");
      await client.query("INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[tokenHash,rows[0].id]);
      await client.query("COMMIT");
      const response=NextResponse.json({role:rows[0].role},{headers:{"Cache-Control":"no-store"}});
      response.cookies.set(sessionCookie,token,{...cookieOptions,maxAge:28800});
      return response;
    }catch{await client.query("ROLLBACK");return NextResponse.json({error:"Authentication unavailable"},{status:503});}finally{client.release();}
  }catch{return NextResponse.json({error:"Authentication unavailable"},{status:503});}
}

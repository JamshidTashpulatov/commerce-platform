import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { database, configuredStoreId } from "../../../../lib/server/db";
import { cookieOptions, sessionCookie } from "../../../../lib/server/auth";
import { privateHeaders, sameOrigin, smallJson } from "../../../../lib/server/http";

const reply=(error:string,status:number)=>NextResponse.json({error},{status,headers:privateHeaders});
const denied=()=>reply("Email, parol yoki faollashtirish kodi noto‘g‘ri.",401);
const slowDown=()=>reply("Urinishlar soni ko‘paydi. Keyinroq qayta urinib ko‘ring.",429);
function derive(password:string,salt:Buffer):Promise<Buffer>{
  return new Promise((resolve,reject)=>scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},
    (error,key)=>error?reject(error):resolve(key)));
}
function validCode(code:unknown){
  const expected=process.env.ADMIN_SETUP_CODE;
  if(!expected || expected.length<32 || typeof code!=="string")return false;
  const digest=(value:string)=>createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(code),digest(expected));
}
export async function POST(request:Request){
  if(!sameOrigin(request))return reply("Ruxsat yo‘q",403);
  const b=await smallJson(request);
  if(!b || typeof b.email!=="string" || b.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())
    || typeof b.password!=="string" || !b.password.length || Buffer.byteLength(b.password)>512
    || !["login","activate"].includes(String(b.action)))return reply("Email va parolni tekshiring.",400);
  const activate=b.action==="activate";
  if(activate && b.password.length<15)return reply("Kamida 15 belgili parol tanlang.",400);
  try{
    const store=configuredStoreId();
    const pool=database();
    const budget=await pool.query(`INSERT INTO admin_login_limits(store_id,attempts,window_start) VALUES($1,1,now())
      ON CONFLICT (store_id) DO UPDATE SET
      attempts=CASE WHEN admin_login_limits.window_start<=now()-interval '1 minute' THEN 1 ELSE admin_login_limits.attempts+1 END,
      window_start=CASE WHEN admin_login_limits.window_start<=now()-interval '1 minute' THEN now() ELSE admin_login_limits.window_start END
      WHERE admin_login_limits.attempts<60 OR admin_login_limits.window_start<=now()-interval '1 minute' RETURNING store_id`,[store]);
    if(!budget.rowCount)return slowDown();
    if(activate && !validCode(b.code))return denied();
    const c=await pool.connect();
    try{
      await c.query("BEGIN");
      const row=(await c.query(`SELECT a.*,m.role,a.window_start<=now()-interval '15 minutes' AS expired FROM admin_credentials a
        JOIN memberships m USING(store_id,account_id) WHERE a.store_id=$1 AND a.email=$2 AND m.role IN ('owner','admin') FOR UPDATE OF a,m`,
        [store,b.email.trim().toLowerCase()])).rows[0];
      if(row && !row.expired && row.attempts>=10){await c.query("ROLLBACK");return slowDown();}
      const salt=activate?randomBytes(16):(row?.salt??Buffer.alloc(16));
      const key=await derive(b.password,salt);
      if(!row || (activate ? row.password_hash!==null : !row.password_hash || !timingSafeEqual(key,row.password_hash))){
        if(row)await c.query(`UPDATE admin_credentials SET attempts=CASE WHEN $3 THEN 1 ELSE attempts+1 END,
          window_start=CASE WHEN $3 THEN now() ELSE window_start END WHERE store_id=$1 AND account_id=$2`,[store,row.account_id,row.expired]);
        await c.query("COMMIT");return denied();
      }
      await c.query(`UPDATE admin_credentials SET salt=$3,password_hash=$4,attempts=0,window_start=now()
        WHERE store_id=$1 AND account_id=$2`,[store,row.account_id,salt,key]);
      const token=randomBytes(32).toString("base64url");
      await c.query(`INSERT INTO sessions(token_hash,account_id,password_store_id,expires_at)
        VALUES($1,$2,$3,now()+interval '8 hours')`,[createHash("sha256").update(token).digest("hex"),row.account_id,store]);
      await c.query("COMMIT");
      const res=NextResponse.json({role:row.role},{headers:privateHeaders});
      res.cookies.set(sessionCookie,token,{...cookieOptions,maxAge:28800});return res;
    }catch{await c.query("ROLLBACK");throw new Error("LOGIN_FAILED");}finally{c.release();}
  }catch{return reply("Kirish xizmati vaqtincha mavjud emas.",503);}
}

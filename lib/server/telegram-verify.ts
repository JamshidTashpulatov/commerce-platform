import { createHmac,timingSafeEqual } from "node:crypto";
export function verifyMiniApp(initData:string,botToken:string,now=Math.floor(Date.now()/1000)){
  if(!botToken || !initData || initData.length>8192)return null;
  const params=new URLSearchParams(initData);
  const entries=Array.from(params.entries());
  if(new Set(entries.map(([key])=>key)).size!==entries.length)return null;
  const hash=params.get("hash");
  const authDate=params.get("auth_date");
  if(!hash || !/^[0-9a-f]{64}$/.test(hash) || !authDate || !/^\d{1,12}$/.test(authDate))return null;
  const timestamp=Number(authDate);
  if(timestamp>now+30 || now-timestamp>300)return null;
  const check=entries.filter(([key])=>key!=="hash").sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+"="+v).join("\n");
  const secret=createHmac("sha256","WebAppData").update(botToken).digest();
  const calculated=createHmac("sha256",secret).update(check).digest();
  if(!timingSafeEqual(calculated,Buffer.from(hash,"hex")))return null;
  try{
    const user:unknown=JSON.parse(params.get("user")??"null");
    if(!user || typeof user!=="object" || !("id" in user) || typeof user.id!=="number" || !Number.isSafeInteger(user.id) || user.id<=0)return null;
    return {telegramUserId:String(user.id),hash,expiresAt:new Date((timestamp+330)*1000)};
  }catch{return null;}
}

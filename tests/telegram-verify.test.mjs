import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {verifyMiniApp} from "../lib/server/telegram-verify.ts";
const token="test-only-token";
const now=1780000000;
function signed(timestamp=now){
  const p=new URLSearchParams({auth_date:String(timestamp),user:JSON.stringify({id:123})});
  const data=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+"="+v).join("\n");
  const key=createHmac("sha256","WebAppData").update(token).digest();
  p.set("hash",createHmac("sha256",key).update(data).digest("hex"));
  return p;
}
test("accepts correctly signed fresh data",()=>assert.equal(verifyMiniApp(signed().toString(),token,now)?.telegramUserId,"123"));
test("rejects modified user",()=>{const p=signed();p.set("user",'{"id":456}');assert.equal(verifyMiniApp(p.toString(),token,now),null);});
test("rejects expired data",()=>assert.equal(verifyMiniApp(signed(now-301).toString(),token,now),null));
test("rejects duplicate keys",()=>{const p=signed();p.append("user",'{"id":123}');assert.equal(verifyMiniApp(p.toString(),token,now),null);});

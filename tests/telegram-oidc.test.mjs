import assert from "node:assert/strict";
import {generateKeyPairSync,sign} from "node:crypto";
import test from "node:test";
import {verifyIdToken,pkceChallenge} from "../lib/server/oidc-verify.ts";

const b64=v=>Buffer.from(typeof v==="string"?v:JSON.stringify(v)).toString("base64url");
const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...publicKey.export({format:"jwk"}),kid:"k1",alg:"RS256"};
const now=1_900_000_000;
const token=(claims,{key=privateKey,kid="k1",alg="RS256"}={})=>{
  const head=b64({alg,kid,typ:"JWT"}),body=b64(claims);
  return head+"."+body+"."+sign("RSA-SHA256",Buffer.from(head+"."+body),key).toString("base64url");
};
const base={iss:"https://oauth.telegram.org",aud:"123456789",sub:"987654321",id:987654321,iat:now-10,exp:now+3600,
  name:"Test Mijoz",phone_number:"998901234567",phone_number_verified:true,nonce:"n1"};

test("accepts a valid Telegram ID token and reads id, name and phone",()=>{
  const claims=verifyIdToken(token(base),[jwk],"123456789",{now,nonce:"n1"});
  assert.equal(claims.telegramUserId,"987654321");
  assert.equal(claims.name,"Test Mijoz");
  assert.equal(claims.phone,"+998901234567");
  assert.match(claims.tokenHash,/^[0-9a-f]{64}$/);
});

test("rejects tokens with the wrong signer, issuer, audience, expiry, nonce or shape",()=>{
  const other=generateKeyPairSync("rsa",{modulusLength:2048}).privateKey;
  assert.equal(verifyIdToken(token(base,{key:other}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token({...base,iss:"https://evil.example"}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token({...base,aud:"111"}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token({...base,exp:now-60}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token({...base,iat:now+3600}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token(base),[jwk],"123456789",{now,nonce:"other"}),null);
  assert.equal(verifyIdToken(token(base,{kid:"unknown"}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token(base,{alg:"HS256"}),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken(token({...base,id:undefined,sub:"not-a-number"}),[jwk],"123456789",{now}),null);
  const [h,b,s]=token(base).split(".");
  assert.equal(verifyIdToken([h,b64({...base,id:1}),s].join("."),[jwk],"123456789",{now}),null);
  assert.equal(verifyIdToken("a.b",[jwk],"123456789",{now}),null);
});

test("accepts a numeric audience and drops an unverifiable phone",()=>{
  const claims=verifyIdToken(token({...base,aud:123456789,phone_number:"call me"}),[jwk],"123456789",{now});
  assert.equal(claims.phone,null);
});

test("PKCE S256 challenge matches RFC 7636 appendix B",()=>{
  assert.equal(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

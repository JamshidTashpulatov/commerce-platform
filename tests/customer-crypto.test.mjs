import test from "node:test";
import assert from "node:assert/strict";
import {customerKeys,normalizedPhone,lookupPhone,seal,unseal,fieldContext} from "../lib/server/customer-crypto.ts";
const keys=customerKeys("11".repeat(32));
test("customer encryption is randomized and authenticated",()=>{
 const ctx=fieldContext("store-a","customer-a","passport");
 const a=seal(keys.encryption,"FIXTURE01",ctx);
 const b=seal(keys.encryption,"FIXTURE01",ctx);
 assert.notEqual(a,b);assert.equal(unseal(keys.encryption,a,ctx),"FIXTURE01");
 assert.throws(()=>unseal(keys.encryption,a,fieldContext("store-b","customer-a","passport")));
 assert.throws(()=>unseal(customerKeys("22".repeat(32)).encryption,a,ctx));
});
test("phone search token is store scoped",()=>{
 assert.equal(normalizedPhone("+1 (202) 555-0100"),"+12025550100");
 assert.equal(normalizedPhone("invalid"),null);
 assert.equal(lookupPhone(keys.lookup,"a","+12025550100"),lookupPhone(keys.lookup,"a","+12025550100"));
 assert.notEqual(lookupPhone(keys.lookup,"a","+12025550100"),lookupPhone(keys.lookup,"b","+12025550100"));
 assert.throws(()=>customerKeys(undefined));
});

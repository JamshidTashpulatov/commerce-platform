import test from "node:test";
import assert from "node:assert/strict";
import {priceInstallment,minimumInitial} from "../lib/installment-pricing.ts";
const policy={minimumInitialBps:2500,monthlyMarkupBps:400};
test("flat markup is based on financed cost",()=>{
 const q=priceInstallment(1000n,300n,3,policy);
 assert.equal(q.principal,"700");assert.equal(q.markup,"84");assert.equal(q.total,"1084");
});
test("minimum is rounded up and markup rounded once",()=>{
 assert.equal(minimumInitial(101n,policy),26n);
 // 26 is the suggested minimum, not a limit: 25 and 0 are valid terms too.
 assert.equal(priceInstallment(101n,25n,3,policy).minimum,"26");
 assert.equal(priceInstallment(101n,25n,3,policy).principal,"76");
 assert.equal(priceInstallment(101n,26n,3,policy).total,"110");
 assert.throws(()=>priceInstallment(1000n,1000n,3,policy));
});
test("the initial payment is optional: zero finances the whole cost",()=>{
 const q=priceInstallment(1000n,0n,3,policy);
 assert.equal(q.initial,"0");assert.equal(q.principal,"1000");assert.equal(q.markup,"120");assert.equal(q.total,"1120");
 assert.throws(()=>priceInstallment(1000n,-1n,3,policy));
 assert.throws(()=>priceInstallment(1000n,1001n,3,policy));
});

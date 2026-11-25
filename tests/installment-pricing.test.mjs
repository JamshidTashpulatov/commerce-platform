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
 assert.throws(()=>priceInstallment(101n,25n,3,policy));
 assert.equal(priceInstallment(101n,26n,3,policy).total,"110");
 assert.throws(()=>priceInstallment(1000n,1000n,3,policy));
});

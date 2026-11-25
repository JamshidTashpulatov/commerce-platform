import test from "node:test";
import assert from "node:assert/strict";
import {allocateProportionally,previewReceiptAllocation} from "../lib/profit-split.ts";
const weights=[{investorId:"A",capital:5n},{investorId:"B",capital:3n},{investorId:"C",capital:2n}];
test("all approved principal and profit is allocated to participating investors",()=>{
 assert.deepEqual(previewReceiptAllocation(1000n,200n,weights),[
 {investorId:"A",principal:500n,profit:100n,total:600n},
 {investorId:"B",principal:300n,profit:60n,total:360n},
 {investorId:"C",principal:200n,profit:40n,total:240n}]);
});
test("whole UZS rounding reconciles exactly and tie breaking is stable",()=>{
 assert.deepEqual(allocateProportionally(2n,[{investorId:"C",capital:1n},{investorId:"A",capital:1n},{investorId:"B",capital:1n}]),[{investorId:"C",amount:0n},{investorId:"A",amount:1n},{investorId:"B",amount:1n}]);
 assert.equal(allocateProportionally(101n,weights).reduce((s,r)=>s+r.amount,0n),101n);
});
test("invalid and duplicate participants are rejected",()=>{
 assert.throws(()=>allocateProportionally(-1n,weights));
 assert.throws(()=>allocateProportionally(1n,[]));
 assert.throws(()=>allocateProportionally(1n,[weights[0],weights[0]]));
 assert.throws(()=>allocateProportionally(1n,[{investorId:"A",capital:0n}]));
});

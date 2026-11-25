import test from "node:test";
import assert from "node:assert/strict";
import {spreadPayment,remainingBalance} from "../lib/installment-spread.ts";
const rows=(...balances)=>balances.map((balance,i)=>({id:"m"+(i+1),sequence_no:i+1,balance}));
const amounts=parts=>parts.map(p=>[p.sequence_no,p.amount]);
test("a payment within the month stays in that month",()=>{
 assert.deepEqual(amounts(spreadPayment(163n,rows(163n,163n,163n),"m1")),[[1,163n]]);
 assert.deepEqual(amounts(spreadPayment(100n,rows(163n,163n,163n),"m1")),[[1,100n]]);
});
test("the excess goes to the following months in order",()=>{
 // 200 against a month that owes 163: 163 here, 37 to the next month.
 assert.deepEqual(amounts(spreadPayment(200n,rows(163n,163n,163n),"m1")),[[1,163n],[2,37n]]);
 assert.deepEqual(amounts(spreadPayment(400n,rows(163n,163n,163n),"m1")),[[1,163n],[2,163n],[3,74n]]);
 // A month that is already paid is skipped; a partly paid month takes only its balance.
 assert.deepEqual(amounts(spreadPayment(300n,rows(0n,163n,0n,50n,163n),"m2")),[[2,163n],[4,50n],[5,87n]]);
});
test("the whole remaining balance can be paid at once, and not a dollar more",()=>{
 const r=rows(63n,163n,163n);
 assert.equal(remainingBalance(r),389n);
 assert.deepEqual(amounts(spreadPayment(389n,r,"m1")),[[1,63n],[2,163n],[3,163n]]);
 assert.throws(()=>spreadPayment(390n,r,"m1"),/OVER_CONTRACT/);
});
test("after the chosen month the earliest unpaid month comes first",()=>{
 assert.deepEqual(amounts(spreadPayment(200n,rows(163n,163n,163n),"m3")),[[3,163n],[1,37n]]);
});
test("a paid month and bad input are refused",()=>{
 assert.throws(()=>spreadPayment(10n,rows(0n,163n),"m1"),/MONTH_PAID/);
 assert.throws(()=>spreadPayment(0n,rows(163n),"m1"));
 assert.throws(()=>spreadPayment(10n,rows(163n),"x"));
});

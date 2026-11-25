import test from "node:test";
import assert from "node:assert/strict";
import {buildSchedule,validDate} from "../lib/installment-schedule.ts";
test("integer UZS allocation reconciles exactly and preserves monthly anchor",()=>{
 const s=buildSchedule(1000n,300n,3,"2027-01-31");
 assert.deepEqual(s.map(x=>x.amount_uzs),["234","233","233"]);
 assert.deepEqual(s.map(x=>x.due_date),["2027-01-31","2027-02-28","2027-03-31"]);
 assert.equal(s.reduce((n,x)=>n+BigInt(x.amount_uzs),0n),700n);
});
test("rejects invalid dates, durations and zero balance",()=>{
 assert.equal(validDate("2027-02-29"),false);
 assert.throws(()=>buildSchedule(100n,100n,1,"2027-01-01"));
 assert.throws(()=>buildSchedule(100n,99n,2,"2027-01-01"));
 assert.throws(()=>buildSchedule(100n,30n,61,"2027-01-01"));
});

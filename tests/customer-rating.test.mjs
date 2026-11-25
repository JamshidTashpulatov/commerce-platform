import test from "node:test";
import assert from "node:assert/strict";
import {rateCustomer,bucketFor,RATING} from "../lib/customer-rating.ts";
const today="2027-06-15";
const row=(due,amount,...receipts)=>({due,amount:BigInt(amount),receipts:receipts.map(([date,a])=>({date,amount:BigInt(a)}))});
const months=["2027-01-10","2027-02-10","2027-03-10","2027-04-10","2027-05-10","2027-06-10"];
// Six due instalments of 100, each paid `delays[i]` days after its due date (null: not paid).
const paidWith=delays=>months.map((due,i)=>{
 if(delays[i]===null)return row(due,100);
 const d=new Date(due+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+delays[i]);
 return row(due,100,[d.toISOString().slice(0,10),100]);
});
const rate=(rows,status="active",extra=[])=>rateCustomer([{status,rows},...extra],today);

test("no instalment due yet is a new customer, not a level",()=>{
 assert.equal(rateCustomer([],today).level,null);
 const future=rate([row("2027-07-10",100),row("2027-08-10",100)]);
 assert.equal(future.level,null);assert.equal(future.score,null);assert.equal(future.due,0);
 assert.equal(future.remainingDebt,"200");assert.match(future.reason,/Yangi mijoz, tarix yo‘q/);
});
test("one worked example per level",()=>{
 // A+: every instalment on its date, and an earlier contract closed well.
 const ideal=rate(paidWith([0,0,0,0,0,0]),"active",[{status:"settled",rows:[row("2026-10-10",100,["2026-10-10",100])]}]);
 assert.deepEqual([ideal.level.key,ideal.score,ideal.parts],["A+",100,{onTime:40,delay:25,paidInFull:20,priorContracts:15}]);
 // A: first contract, one payment 5 days late.
 const good=rate(paidWith([0,0,5,0,0,0]));
 assert.deepEqual([good.level.key,good.score,good.parts],["A",81,{onTime:33,delay:18,paidInFull:20,priorContracts:10}]);
 // B: two payments late, the worst by 12 days.
 const average=rate(paidWith([0,12,0,6,0,0]));
 assert.deepEqual([average.level.key,average.score,average.parts],["B",69,{onTime:27,delay:12,paidInFull:20,priorContracts:10}]);
 // C: three payments late, the worst by 25 days.
 const risky=rate(paidWith([0,25,10,0,9,0]));
 assert.deepEqual([risky.level.key,risky.score,risky.parts],["C",56,{onTime:20,delay:6,paidInFull:20,priorContracts:10}]);
 // D: the last three instalments are not paid, the oldest for 66 days.
 const high=rate(paidWith([0,10,0,null,null,null]));
 assert.deepEqual([high.level.key,high.score,high.parts],["D",23,{onTime:13,delay:0,paidInFull:10,priorContracts:0}]);
 assert.equal(high.overdue,3);assert.equal(high.overdueAmount,"300");assert.equal(high.oldestOverdueDays,66);
 assert.equal(high.worstBucket,"Jiddiy qarzdorlik");
});
test("the grace period, part payments and the day an instalment became fully paid",()=>{
 // 3 days late is within the grace period; 4 days is late.
 assert.equal(rate([row("2027-03-10",100,["2027-03-13",100])]).onTime,1);
 const four=rate([row("2027-03-10",100,["2027-03-14",100])]);
 assert.equal(four.late,1);assert.equal(four.worstDelayDays,4);
 // Paid in two parts: fully paid on the day of the second part.
 const parts=rate([row("2027-03-10",100,["2027-03-10",60],["2027-03-20",40])]);
 assert.equal(parts.late,1);assert.equal(parts.worstDelayDays,10);
 // A part payment does not clear the instalment: it is overdue for the rest.
 const partly=rate([row("2027-06-01",100,["2027-06-01",60])]);
 assert.equal(partly.overdue,1);assert.equal(partly.overdueAmount,"40");assert.equal(partly.oldestOverdueDays,14);assert.equal(partly.parts.paidInFull,12);
 // Paid before the due date is on time.
 assert.equal(rate([row("2027-03-10",100,["2027-02-20",100])]).onTime,1);
});
test("future instalments are neutral, also when paid early by an overpayment",()=>{
 const r=rate([row("2027-06-10",100,["2027-06-10",100]),row("2027-07-10",100,["2027-06-10",40]),row("2027-08-10",100)]);
 assert.equal(r.due,1);assert.equal(r.onTime,1);assert.equal(r.remainingDebt,"160");assert.equal(r.score,95);
});
test("the last six instalments are listed oldest first",()=>{
 const r=rate(paidWith([0,10,0,null,0,0]));
 assert.deepEqual(r.recent.map(m=>m.state),["on_time","late","on_time","overdue","on_time","on_time"]);
 assert.match(r.reason,/^6 to‘lovdan 4 tasi vaqtida, 1 tasi kechikib to‘langan \(eng ko‘pi 10 kun\), 1 tasi hozir to‘lanmagan \(eng eskisi 66 kun\)\.$/);
});
test("closed contracts: closed well, closed with delays",()=>{
 const well=rate([row("2027-06-10",100,["2027-06-10",100])],"active",[{status:"settled",rows:[row("2026-09-10",100,["2026-09-15",100])]}]);
 assert.equal(well.parts.priorContracts,RATING.priorContracts.closedWell);assert.equal(well.closedContracts,1);
 const lateClosed=rate([row("2027-06-10",100,["2027-06-10",100])],"active",[{status:"settled",rows:[row("2026-09-10",100,["2026-09-30",100])]}]);
 assert.equal(lateClosed.parts.priorContracts,RATING.priorContracts.closedLate);
});
test("days past due buckets",()=>{
 assert.deepEqual([0,1,3,4,7,8,15,16,30,31,400].map(d=>bucketFor(d).key),["normal","small","small","warning","warning","risky","risky","high","high","serious","serious"]);
 assert.equal(Object.values(RATING.points).reduce((a,b)=>a+b,0),100);
});

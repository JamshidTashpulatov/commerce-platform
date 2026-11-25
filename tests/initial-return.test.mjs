import test from "node:test";
import assert from "node:assert/strict";
import {initialReturnShares,initialReturnIsProportional} from "../lib/initial-return.ts";
const fund=(rows)=>rows.map(([id,invested,returned=0n])=>({id,invested,returned}));
const shares=(received,rows)=>initialReturnShares(received,fund(rows)).map(r=>r.share);

test("an initial payment returns to investors in proportion to their funding",()=>{
 // Cost 1250 funded 250 each by five investors, initial 500: 100 each.
 assert.deepEqual(shares(500n,[["a",250n],["b",250n],["c",250n],["d",250n],["e",250n]]),[100n,100n,100n,100n,100n]);
 assert.deepEqual(shares(300n,[["a",700n],["b",300n]]),[210n,90n]);
 assert.deepEqual(shares(2500000n,[["a",6000000n],["b",4000000n]]),[1500000n,1000000n]);
});
test("leftover dollars go to the largest fractional parts, ties to the smaller id",()=>{
 // 100 over 1:1:1 is 33.33 each: one leftover dollar, equal fractions, the first id gets it.
 assert.deepEqual(shares(100n,[["b",1n*50n],["a",50n],["c",50n]]),[33n,34n,33n]);
 // 10 over 6:6:2 is 4.29, 4.29, 1.43: the leftover dollar goes to the 0.43.
 assert.deepEqual(shares(10n,[["a",6n],["b",6n],["c",2n]]),[4n,4n,2n]);
});
test("every split adds up and stays within one dollar of the exact proportion",()=>{
 const rows=[["a",5n],["b",9n],["c",3n],["d",1000n],["e",1n]];
 const funded=rows.reduce((n,r)=>n+r[1],0n);
 for(let received=0n;received<funded;received++){
  const out=initialReturnShares(received,fund(rows));
  assert.equal(out.reduce((n,r)=>n+r.share,0n),received);
  assert.ok(initialReturnIsProportional(received,funded,out.map((r,i)=>({invested:rows[i][1],returned:r.total}))),"received "+received);
 }
});
test("an initial paid in parts never takes a posted return back and still adds up",()=>{
 const rows=[["a",6n],["b",6n],["c",2n]];
 let returned=[0n,0n,0n];let received=0n;
 for(const part of [10n,1n,1n,1n]){
  received+=part;
  const out=initialReturnShares(received,rows.map(([id,invested],i)=>({id,invested,returned:returned[i]})));
  assert.ok(out.every(r=>r.share>=0n));
  assert.equal(out.reduce((n,r)=>n+r.share,0n),part);
  returned=out.map(r=>r.total);
  assert.ok(initialReturnIsProportional(received,14n,returned.map((r,i)=>({invested:rows[i][1],returned:r}))));
 }
 assert.deepEqual(returned,[6n,5n,2n]);
});
test("a later part goes to the investors left behind by an older hand-typed split",()=>{
 // 250 and 250 were typed by hand for two of five equal investors; the next 100 goes to the other three.
 assert.deepEqual(shares(600n,[["a",250n,250n],["b",250n,250n],["c",250n],["d",250n],["e",250n]]),[0n,0n,34n,33n,33n]);
});
test("a hand-typed split that is off the proportion is detected",()=>{
 const typed=[250n,250n,0n,0n,0n].map(returned=>({invested:250n,returned}));
 assert.equal(initialReturnIsProportional(500n,1250n,typed),false);
 assert.equal(initialReturnIsProportional(500n,1250n,typed.map(r=>({...r,returned:100n}))),true);
});
test("invalid input is rejected",()=>{
 assert.throws(()=>initialReturnShares(1n,[]));
 assert.throws(()=>initialReturnShares(11n,fund([["a",10n]])));
 assert.throws(()=>initialReturnShares(1n,fund([["a",10n],["a",10n]])));
 assert.throws(()=>initialReturnShares(1n,fund([["a",10n,2n]])));
});

import test from "node:test";
import assert from "node:assert/strict";
import { cumulativeMonthlyShares } from "../lib/monthly-allocation.ts";

test("approved partial receipt splits both components using original investments",()=>{
  const shares=[{id:"a",invested:750000n,initial:150000n},{id:"b",invested:500000n,initial:100000n}];
  assert.deepEqual(cumulativeMonthlyShares(120000n,1000000n,200000n,shares),[
    {id:"a",principal:60000n,profit:12000n},{id:"b",principal:40000n,profit:8000n}
  ]);
});
test("every cumulative whole-UZS target reconciles and never reduces a previous credit",()=>{
  const shares=[{id:"a",invested:5n,initial:2n},{id:"b",invested:9n,initial:3n},{id:"c",invested:3n,initial:1n}];
  let prior=cumulativeMonthlyShares(0n,11n,13n,shares);
  for(let paid=1n;paid<=24n;paid++){
    const rows=cumulativeMonthlyShares(paid,11n,13n,shares);
    assert.equal(rows.reduce((n,r)=>n+r.principal+r.profit,0n),paid);
    rows.forEach((r,i)=>{assert.ok(r.principal>=prior[i].principal && r.profit>=prior[i].profit);});
    prior=rows;
  }
  assert.deepEqual(prior.map(r=>r.principal),[3n,6n,2n]);
});

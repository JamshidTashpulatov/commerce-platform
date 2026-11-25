import test from "node:test";
import assert from "node:assert/strict";
import {splitApprovedProfit} from "../lib/profit-split.ts";
test("investor pool and business share reconcile to approved profit",()=>{
 assert.deepEqual(splitApprovedProfit(1000n,7500),{investorPool:750n,businessShare:250n});
 assert.deepEqual(splitApprovedProfit(101n,8000),{investorPool:80n,businessShare:21n});
});
test("invalid shares and negative profit are rejected",()=>{
 assert.throws(()=>splitApprovedProfit(1000n,10001));
 assert.throws(()=>splitApprovedProfit(-1n,7500));
 assert.throws(()=>splitApprovedProfit(1000n,7500.5));
});

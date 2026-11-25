import test from "node:test";
import assert from "node:assert/strict";
import {equalSplit} from "../lib/funding-split.ts";

const inv=(id,available)=>({id,available:BigInt(available)});
const sum=shares=>Object.values(shares).reduce((n,v)=>n+BigInt(v),0n);

test("equal split gives whole dollars that add up exactly",()=>{
  const r=equalSplit(10_000_000n,[inv("a",9_000_000),inv("b",9_000_000),inv("c",9_000_000)]);
  assert.deepEqual(r.shares,{a:"3333334",b:"3333333",c:"3333333"});
  assert.equal(sum(r.shares),10_000_000n);
  assert.deepEqual(r.short,[]);
});
test("the leftover goes to the first investors in the given order, every time",()=>{
  const first=equalSplit(11n,[inv("a",100),inv("b",100),inv("c",100)]);
  assert.deepEqual(first.shares,{a:"4",b:"4",c:"3"});
  assert.deepEqual(equalSplit(11n,[inv("c",100),inv("b",100),inv("a",100)]).shares,{c:"4",b:"4",a:"3"});
  assert.deepEqual(equalSplit(11n,[inv("a",100),inv("b",100),inv("c",100)]),first);
});
test("a single investor takes everything",()=>{
  assert.deepEqual(equalSplit(7_500_000n,[inv("a",8_000_000)]).shares,{a:"7500000"});
});
test("nothing is shifted when someone is short: the shortfall is reported instead",()=>{
  const r=equalSplit(12_000_000n,[inv("a",10_000_000),inv("b",3_500_000),inv("c",4_000_000)]);
  assert.deepEqual(r.shares,{});
  assert.deepEqual(r.short,[{id:"b",share:4_000_000n,missing:500_000n}]);
});
test("no investors or no amount gives nothing",()=>{
  assert.deepEqual(equalSplit(1000n,[]),{shares:{},short:[]});
  assert.deepEqual(equalSplit(0n,[inv("a",5)]),{shares:{},short:[]});
});
test("more investors than dollars leaves the last ones out",()=>{
  assert.deepEqual(equalSplit(2n,[inv("a",5),inv("b",5),inv("c",5)]).shares,{a:"1",b:"1"});
});

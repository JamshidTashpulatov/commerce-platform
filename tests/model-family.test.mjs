import assert from "node:assert/strict";
import test from "node:test";
import {modelFamily} from "../lib/storefront.ts";

test("model families group tiers and sizes of one generation", () => {
  const cases = {
    "iPhone 18 Pro Max": "iPhone 18", "iPhone 18 Pro": "iPhone 18", "iPhone 17e": "iPhone 17",
    "iPhone 16 Plus": "iPhone 16", "iPhone Air": "iPhone Air", "iPhone Duo": "iPhone Duo",
    "MacBook Pro 14″": "MacBook Pro", "MacBook Air 15″": "MacBook Air", "Studio Display XDR": "Studio Display XDR",
    "iPad mini": "iPad mini", "iPad Pro": "iPad Pro", "AirPods Pro 3": "AirPods Pro 3",
    "Apple Watch Series 12": "Apple Watch Series 12", "HomePod mini 2": "HomePod mini 2",
  };
  for (const [name, family] of Object.entries(cases)) assert.equal(modelFamily(name), family, name);
});

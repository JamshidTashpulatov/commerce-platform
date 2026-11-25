import assert from "node:assert/strict";
import test from "node:test";
import {parseRate,retailDollars} from "../scripts/convert-prices-to-usd.mjs";

test("so'm prices become retail whole-dollar prices", () => {
  const rate = 12500;
  for (const [soum, usd] of [[9987500, 799], [10042500, 799], [15590000, 1249], [312500, 25], [310000, 25], [62000, 5], [5000, 1], [187500, 15], [1240000, 99], [1250000, 100], [1255000, 99], [43737500, 3499]]) assert.equal(retailDollars(soum, rate), usd, String(soum));
  assert.throws(() => retailDollars(0, rate));
});

test("the rate must be a plausible so'm per dollar figure", () => {
  assert.equal(parseRate("--rate=12500"), 12500);
  assert.equal(parseRate("--rate=12650.5"), 12650.5);
  for (const bad of [undefined, "--rate=", "--rate=12,500", "--rate=0.0001", "--rate=500", "--rate=1e4", "--rate=-12500"]) assert.throws(() => parseRate(bad), bad);
});

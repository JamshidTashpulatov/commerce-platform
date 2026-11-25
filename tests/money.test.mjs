import assert from "node:assert/strict";
import test from "node:test";
import {CURRENCY,formatFrom,formatMoney,groupMoneyDigits,parseMoney} from "../lib/money.ts";

test("money formats whole US dollars", () => {
  assert.equal(CURRENCY.code, "USD");
  assert.equal(formatMoney("1250"), "$1,250");
  assert.equal(formatMoney(0), "$0");
  assert.equal(formatMoney(BigInt("1234567890123")), "$1,234,567,890,123");
  assert.equal(formatMoney("-1250"), "−$1,250");
  assert.equal(formatMoney("12.5"), "—");
  assert.equal(formatMoney(1.5), "—");
  assert.equal(formatMoney(null), "—");
  assert.equal(formatFrom("999"), "$999 dan");
});

test("money input accepts what people type and rejects the rest", () => {
  for (const [input, out] of [["$1,250", "1250"], ["1 250", "1250"], ["1250", "1250"], ["1250.00", "1250"], [" 007 ", "7"], ["999999999", "999999999"]]) assert.equal(parseMoney(input), out, input);
  for (const input of ["", "0", "-5", "12.50", "1e3", "abc", "1000000000", "$"]) assert.equal(parseMoney(input), null, input);
  assert.equal(parseMoney("0", { allowZero: true }), "0");
  assert.equal(groupMoneyDigits("001234567"), "1,234,567");
});

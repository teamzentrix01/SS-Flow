import assert from "node:assert/strict";
import test from "node:test";
import { isValidGstin, normalizeGstin, normalizePhone } from "@/modules/leads/duplicates";

test("normalizePhone strips country code and leading zero", () => {
  assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhone("09876543210"), "9876543210");
});

test("gstin validation accepts standard format", () => {
  const sample = "22AAAAA0000A1Z5";
  assert.equal(normalizeGstin("22aaaaa0000a1z5"), sample);
  assert.equal(isValidGstin(sample), true);
  assert.equal(isValidGstin(""), true);
  assert.equal(isValidGstin("BAD"), false);
});

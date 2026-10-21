import assert from "node:assert/strict";
import test from "node:test";
import { convertQuantity, isMassUom } from "./uom";

test("mass conversion uses 1 MT = 1000 KG without changing quantity meaning", () => {
  assert.equal(convertQuantity("1.250", "MT", "KG"), "1250.000");
  assert.equal(convertQuantity("2500", "kg", "T"), "2.500");
  assert.equal(convertQuantity("1", "KG", "T"), "0.001");
});

test("incompatible units and conversions beyond supported precision are rejected", () => {
  assert.equal(convertQuantity("1", "PCS", "KG"), null);
  assert.equal(convertQuantity("0.001", "KG", "MT"), null);
  assert.equal(isMassUom("SHEET"), false);
});

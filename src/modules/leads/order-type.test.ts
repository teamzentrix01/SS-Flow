import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCustomLeadOrder, normalizeLeadOrderType } from "./order-type";

describe("lead order type", () => {
  it("defaults and migrates legacy STANDARD to READY_STOCK", () => {
    assert.equal(normalizeLeadOrderType(undefined), "READY_STOCK");
    assert.equal(normalizeLeadOrderType("STANDARD"), "READY_STOCK");
    assert.equal(normalizeLeadOrderType("ready_stock"), "READY_STOCK");
    assert.equal(normalizeLeadOrderType("CUSTOM"), "CUSTOM");
  });

  it("detects custom orders for PO warnings", () => {
    assert.equal(isCustomLeadOrder("CUSTOM"), true);
    assert.equal(isCustomLeadOrder("READY_STOCK"), false);
    assert.equal(isCustomLeadOrder("STANDARD"), false);
  });
});

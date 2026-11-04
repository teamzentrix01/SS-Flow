import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLineAmount, lineDiscountPct, quotationNeedsDiscountApproval } from "./pricing";

describe("quotation pricing", () => {
  it("computes discount percent from list and offered rate", () => {
    assert.equal(lineDiscountPct(100, 90), 10);
    assert.equal(lineDiscountPct(100, 100), 0);
  });

  it("flags approval when discount exceeds default limit", () => {
    process.env.QUOTATION_MAX_DISCOUNT_PCT = "5";
    assert.equal(
      quotationNeedsDiscountApproval([{ listRate: "100", rate: "94" }]),
      true,
    );
    assert.equal(
      quotationNeedsDiscountApproval([{ listRate: "100", rate: "96" }]),
      false,
    );
    delete process.env.QUOTATION_MAX_DISCOUNT_PCT;
  });

  it("computes line amount", () => {
    assert.equal(computeLineAmount("10", "25.5"), "255.00");
  });
});

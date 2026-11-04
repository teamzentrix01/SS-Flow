import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLostReasonCodeForStatus, lostReasonLabel } from "./lost-reason";

describe("lost reason codes", () => {
  it("validates LOST vs REJECTED sets", () => {
    assert.equal(isLostReasonCodeForStatus("LOST", "PRICE_HIGH"), true);
    assert.equal(isLostReasonCodeForStatus("LOST", "BELOW_MOQ"), false);
    assert.equal(isLostReasonCodeForStatus("REJECTED", "BELOW_MOQ"), true);
    assert.equal(isLostReasonCodeForStatus("REJECTED", "PRICE_HIGH"), false);
  });

  it("labels OTHER consistently", () => {
    assert.equal(lostReasonLabel("OTHER", "LOST"), "Other");
    assert.equal(lostReasonLabel("OTHER", "REJECTED"), "Other");
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { LEAD_STATUSES, canTransitionLead, manualLeadStatusOptions } from "@/modules/leads/status";

const CUSTOM = { orderType: "CUSTOM" as const };
const READY = { orderType: "READY_STOCK" as const };

test("manual options never include VERIFIED or CONVERTED", () => {
  for (const from of LEAD_STATUSES) {
    const options = manualLeadStatusOptions(from, "READY_STOCK");
    assert.ok(!options.includes("VERIFIED"));
    assert.ok(!options.includes("CONVERTED"));
  }
});

test("SAMPLE_APPROVAL only for CUSTOM from quote or negotiation", () => {
  assert.equal(canTransitionLead("QUOTATION_SENT", "SAMPLE_APPROVAL", READY), false);
  assert.equal(canTransitionLead("QUOTATION_SENT", "SAMPLE_APPROVAL", CUSTOM), true);
  assert.equal(canTransitionLead("NEGOTIATION", "SAMPLE_APPROVAL", CUSTOM), true);
  assert.equal(canTransitionLead("VERIFIED", "SAMPLE_APPROVAL", CUSTOM), false);
});

test("VERIFIED and CONVERTED cannot be set via manual transition helper", () => {
  assert.equal(canTransitionLead("CONTACTED", "VERIFIED"), false);
  assert.equal(canTransitionLead("VERIFIED", "CONVERTED"), true);
  assert.equal(canTransitionLead("QUOTATION_SENT", "CONVERTED"), true);
});

test("terminal leads can reopen to contacted or follow-up only", () => {
  assert.equal(canTransitionLead("LOST", "CONTACTED"), true);
  assert.equal(canTransitionLead("LOST", "QUOTATION_SENT"), false);
  assert.equal(canTransitionLead("REJECTED", "FOLLOW_UP"), true);
  assert.equal(canTransitionLead("CONVERTED", "CONTACTED"), false);
});

test("blocked transitions from NEW", () => {
  assert.equal(canTransitionLead("NEW", "QUOTATION_SENT"), false);
  assert.equal(canTransitionLead("NEW", "CONVERTED"), false);
  assert.equal(canTransitionLead("NEW", "CONTACTED"), true);
});

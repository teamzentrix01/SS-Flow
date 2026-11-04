import assert from "node:assert/strict";
import test from "node:test";
import { leadConvertSchema, leadStatusChangeSchema, leadVerifySchema } from "@/lib/schemas";
import {
  canTransitionLead,
  leadCanConvert,
  leadCanVerify,
  leadRequiresLostReason,
  leadStatusLabel,
  manualLeadStatusOptions,
} from "@/modules/leads/status";

test("verification requires every confirmation and keeps notes optional", () => {
  const checks = {
    customerConfirmed: true,
    itemsConfirmed: true,
    quantityConfirmed: true,
    genuineRequirementConfirmed: true,
  } as const;
  assert.equal(leadVerifySchema.safeParse({ checks }).success, true);
  assert.equal(leadVerifySchema.safeParse({ checks: { ...checks, quantityConfirmed: false } }).success, false);
  assert.equal(leadVerifySchema.safeParse({ checks: { customerConfirmed: true } }).success, false);
});

test("verification is available before qualified or terminal states", () => {
  assert.equal(leadCanVerify("NEW"), true);
  assert.equal(leadCanVerify("ON_HOLD"), true);
  assert.equal(leadCanVerify("VERIFICATION_PENDING"), true);
  assert.equal(leadCanVerify("VERIFIED"), false);
  assert.equal(leadCanVerify("REJECTED"), false);
  assert.equal(canTransitionLead("NEW", "VERIFIED"), false);
  assert.equal(canTransitionLead("REJECTED", "VERIFIED"), false);
});

test("conversion is allowed from qualified, quote, negotiation, and sample approval", () => {
  const leadItemId = "d2719c81-5a66-45c6-a215-6c4131fb6c5d";
  const productId = "58b4ef2a-06bb-4470-92e1-f30a1c48c792";
  assert.equal(leadCanConvert("VERIFIED"), true);
  assert.equal(leadCanConvert("QUOTATION_SENT"), true);
  assert.equal(leadCanConvert("NEGOTIATION"), true);
  assert.equal(leadCanConvert("SAMPLE_APPROVAL"), true);
  assert.equal(leadCanConvert("REJECTED"), false);
  assert.equal(leadConvertSchema.safeParse({ lines: [{ leadItemId, productId }] }).success, true);
  assert.equal(leadConvertSchema.safeParse({ lines: [] }).success, false);
  assert.equal(leadConvertSchema.safeParse({ lines: [{ leadItemId: "bad-id" }] }).success, false);
});

test("rejection and loss transitions require a reason", () => {
  assert.equal(leadRequiresLostReason("REJECTED"), true);
  assert.equal(leadRequiresLostReason("LOST"), true);
  assert.equal(leadRequiresLostReason("VERIFIED"), false);
});

test("lost and rejected status changes require structured codes", () => {
  assert.equal(leadStatusChangeSchema.safeParse({ status: "LOST" }).success, false);
  assert.equal(
    leadStatusChangeSchema.safeParse({ status: "LOST", lostReasonCode: "PRICE_HIGH" }).success,
    true,
  );
  assert.equal(
    leadStatusChangeSchema.safeParse({ status: "LOST", lostReasonCode: "OTHER" }).success,
    false,
  );
  assert.equal(
    leadStatusChangeSchema.safeParse({
      status: "LOST",
      lostReasonCode: "OTHER",
      lostReasonNote: "Customer chose local vendor",
    }).success,
    true,
  );
  assert.equal(
    leadStatusChangeSchema.safeParse({ status: "REJECTED", lostReasonCode: "BELOW_MOQ" }).success,
    true,
  );
  assert.equal(
    leadStatusChangeSchema.safeParse({ status: "REJECTED", lostReasonCode: "PRICE_HIGH" }).success,
    false,
  );
});

test("manual stage options follow pipeline order and deprecate verification pending", () => {
  assert.equal(leadStatusLabel("VERIFIED"), "Qualified");
  assert.equal(leadStatusLabel("VERIFICATION_PENDING"), "Ready for verification (legacy)");
  assert.deepEqual(manualLeadStatusOptions("NEW"), [
    "CONTACTED",
    "FOLLOW_UP",
    "ON_HOLD",
    "LOST",
    "REJECTED",
  ]);
  assert.ok(!manualLeadStatusOptions("CONTACTED").includes("VERIFIED"));
  assert.ok(!manualLeadStatusOptions("CONTACTED").includes("CONVERTED"));
  assert.ok(!manualLeadStatusOptions("CONTACTED").includes("VERIFICATION_PENDING"));
  assert.ok(manualLeadStatusOptions("CONTACTED").includes("QUOTATION_SENT"));
  assert.ok(manualLeadStatusOptions("QUOTATION_SENT").includes("NEGOTIATION"));
});

test("sample approval transitions require custom order type", () => {
  assert.equal(canTransitionLead("QUOTATION_SENT", "SAMPLE_APPROVAL", { orderType: "READY_STOCK" }), false);
  assert.equal(canTransitionLead("QUOTATION_SENT", "SAMPLE_APPROVAL", { orderType: "CUSTOM" }), true);
  assert.equal(canTransitionLead("NEGOTIATION", "SAMPLE_APPROVAL", { orderType: "CUSTOM" }), true);
  assert.ok(manualLeadStatusOptions("QUOTATION_SENT", "STANDARD").includes("NEGOTIATION"));
  assert.ok(!manualLeadStatusOptions("QUOTATION_SENT", "READY_STOCK").includes("SAMPLE_APPROVAL"));
  assert.ok(manualLeadStatusOptions("QUOTATION_SENT", "CUSTOM").includes("SAMPLE_APPROVAL"));
});

test("negotiation can return to quotation sent or move toward conversion", () => {
  assert.equal(canTransitionLead("NEGOTIATION", "QUOTATION_SENT"), true);
  assert.equal(canTransitionLead("QUOTATION_SENT", "NEGOTIATION"), true);
});

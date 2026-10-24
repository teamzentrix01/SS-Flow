import assert from "node:assert/strict";
import test from "node:test";
import { leadConvertSchema, leadVerifySchema } from "@/lib/schemas";
import { canTransitionLead, leadCanConvert, leadCanVerify, leadRequiresLostReason } from "@/modules/leads/status";

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

test("verification is available only before verified or terminal states", () => {
  assert.equal(leadCanVerify("NEW"), true);
  assert.equal(leadCanVerify("VERIFICATION_PENDING"), true);
  assert.equal(leadCanVerify("VERIFIED"), false);
  assert.equal(leadCanVerify("REJECTED"), false);
  assert.equal(canTransitionLead("NEW", "VERIFIED"), true);
  assert.equal(canTransitionLead("REJECTED", "VERIFIED"), false);
});

test("conversion is restricted to verified leads and requires review lines", () => {
  const leadItemId = "d2719c81-5a66-45c6-a215-6c4131fb6c5d";
  const productId = "58b4ef2a-06bb-4470-92e1-f30a1c48c792";
  assert.equal(leadCanConvert("VERIFIED"), true);
  assert.equal(leadCanConvert("QUOTATION_SENT"), true);
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

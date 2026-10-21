import assert from "node:assert/strict";
import test from "node:test";
import { validateSubstitutionDecision } from "./material-substitution";

const pending = { status: "pending", requestedBy: "requester", actorId: "approver", canApprove: true, decision: "approve" as const };

test("only a distinct purchase approver may approve a pending substitution", () => {
  assert.equal(validateSubstitutionDecision({ ...pending, canApprove: false }), "FORBIDDEN");
  assert.equal(validateSubstitutionDecision({ ...pending, actorId: "requester" }), "SEPARATION_OF_DUTIES");
  assert.equal(validateSubstitutionDecision({ ...pending, status: "approved" }), "INVALID_STATE");
  assert.equal(validateSubstitutionDecision({ ...pending, decision: "reject" }), "REJECTION_REASON_REQUIRED");
  assert.equal(validateSubstitutionDecision({ ...pending, decision: "reject", reason: "Not suitable" }), null);
});

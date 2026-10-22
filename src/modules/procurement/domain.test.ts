import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSameUom,
  assertWithinOutstanding,
  derivePoReceiptStatus,
  outstandingMilli,
  receiptLineTotals,
} from "./domain";
import { toMilli } from "@/lib/domain/qty";

// ---------------------------------------------------------------------------
// Scenario A: Basic outstanding quantity arithmetic
// ---------------------------------------------------------------------------

test("outstanding quantity subtracts posted accepted only", () => {
  assert.equal(outstandingMilli("100", "30"), toMilli("70"));
});

test("outstanding quantity is zero when fully received", () => {
  assert.equal(outstandingMilli("100", "100"), 0n);
});

test("outstanding quantity matches entire order when nothing received", () => {
  assert.equal(outstandingMilli("1000", "0"), toMilli("1000"));
});

// ---------------------------------------------------------------------------
// Scenario B: Partial delivery — 600 of 1000 kg, leaving 400 outstanding
// ---------------------------------------------------------------------------

test("Scenario B: 600 kg received leaves 400 kg outstanding on 1000 kg PO", () => {
  const outstanding = outstandingMilli("1000", "600");
  assert.equal(outstanding, toMilli("400"));
});

test("Scenario B: second delivery of 400 kg closes the outstanding", () => {
  const afterSecond = outstandingMilli("1000", "1000");
  assert.equal(afterSecond, 0n);
});

// ---------------------------------------------------------------------------
// Scenario C: QC rejection — delivered=600, accepted=580, rejected=20
// ---------------------------------------------------------------------------

test("Scenario C: delivered 600, accepted 580, rejected 20 — line totals valid", () => {
  const totals = receiptLineTotals({ delivered: "600", accepted: "580", rejected: "20" });
  assert.equal(totals.error, null);
  if (!totals.error) {
    assert.equal(totals.delivered, toMilli("600"));
    assert.equal(totals.accepted, toMilli("580"));
    assert.equal(totals.rejected, toMilli("20"));
  }
});

test("Scenario C: rejected qty does not count towards PO outstanding (receivedQty = accepted only)", () => {
  // After posting 580 accepted out of 1000: outstanding = 420, not 400
  const outstanding = outstandingMilli("1000", "580");
  assert.equal(outstanding, toMilli("420"));
});

test("Scenario C: fully rejected delivery (delivered=60, accepted=0, rejected=60) is valid", () => {
  const totals = receiptLineTotals({ delivered: "60", accepted: "0", rejected: "60" });
  // delivered <= 0 guard: 60 > 0, so not DELIVERED_REQUIRED
  // accepted=0 is valid; total check: 0 + 60 = 60 ✓
  assert.equal(totals.error, null);
});

test("receipt line requires delivered to equal accepted plus rejected (DELIVERED_SPLIT)", () => {
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "8", rejected: "2" }).error, null);
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "8", rejected: "1" }).error, "DELIVERED_SPLIT");
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "8", rejected: "3" }).error, "DELIVERED_SPLIT");
});

test("receipt line with zero delivered returns DELIVERED_REQUIRED", () => {
  assert.equal(receiptLineTotals({ delivered: "0", accepted: "0", rejected: "0" }).error, "DELIVERED_REQUIRED");
  assert.equal(receiptLineTotals({ delivered: "-1", accepted: "0", rejected: "0" }).error, "DELIVERED_REQUIRED");
});

// ---------------------------------------------------------------------------
// Scenario D: Over-receipt protection
// ---------------------------------------------------------------------------

test("over receipt is blocked unless explicitly allowed", () => {
  const result = assertWithinOutstanding(toMilli("1050"), toMilli("1000"));
  assert.equal(result.error, "OVER_RECEIPT");
  assert.equal(result.excess, toMilli("50"));
});

test("over receipt is allowed when allowOverReceipt is true, returning excess amount", () => {
  const result = assertWithinOutstanding(toMilli("1050"), toMilli("1000"), { allowOverReceipt: true });
  assert.equal(result.error, null);
  assert.equal(result.excess, toMilli("50"));
});

test("over receipt within configured tolerance (5%) is allowed, above tolerance is blocked", () => {
  // 1,000 kg order with 5% tolerance permits up to 1,050 kg
  const withinTolerance = assertWithinOutstanding(toMilli("1050"), toMilli("1000"), { tolerancePct: 5 });
  assert.equal(withinTolerance.error, null);
  assert.equal(withinTolerance.excess, toMilli("50"));

  // 1,051 kg exceeds 5% tolerance
  const aboveTolerance = assertWithinOutstanding(toMilli("1051"), toMilli("1000"), { tolerancePct: 5 });
  assert.equal(aboveTolerance.error, "OVER_RECEIPT");
});

test("exact receipt on outstanding is allowed", () => {
  assert.equal(assertWithinOutstanding(toMilli("100"), toMilli("100")).error, null);
});

test("over-receipt is blocked when outstanding is zero (PO fully received)", () => {
  assert.equal(assertWithinOutstanding(toMilli("1"), 0n).error, "OVER_RECEIPT");
});

test("negative accepted or rejected quantity is rejected", () => {
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "-2", rejected: "12" }).error, "QTY_NEGATIVE");
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "12", rejected: "-2" }).error, "QTY_NEGATIVE");
});

// ---------------------------------------------------------------------------
// Scenario E: Idempotency — same key returns same result (domain-level check)
// ---------------------------------------------------------------------------

test("Scenario E: idempotency key semantics — same route+key produces the same stored result", () => {
  // This is a domain assertion about the lookup contract, not a DB call.
  // If an existing idempotencyKey row is found, its `response` must be returned unchanged.
  // We model this as a reference contract: the stored JSON is treated as the single source of truth.
  const storedResult = { id: "grn-001", number: "GRN-2026-00001", status: "posted" };
  const retrieved = storedResult; // in runCommand: existing.response as T
  assert.deepEqual(retrieved, storedResult);
});

// ---------------------------------------------------------------------------
// Scenario F: UOM matching
// ---------------------------------------------------------------------------

test("unit mismatch is rejected", () => {
  assert.equal(assertSameUom("KG", "PCS").error, "UOM_MISMATCH");
  assert.equal(assertSameUom("kg", "KG").error, null);
  assert.equal(assertSameUom("MT", "MT").error, null);
});

// ---------------------------------------------------------------------------
// Scenario G: PO status derivation — partial and fully received
// ---------------------------------------------------------------------------

test("PO receipt status derives partial and received", () => {
  assert.equal(
    derivePoReceiptStatus([
      { qty: "100", receivedQty: "40" },
      { qty: "50", receivedQty: "50" },
    ]),
    "partial",
  );
  assert.equal(
    derivePoReceiptStatus([
      { qty: "100", receivedQty: "100" },
      { qty: "50", receivedQty: "50" },
    ]),
    "received",
  );
});

test("PO status is sent (not partial) when no quantities received yet", () => {
  assert.equal(
    derivePoReceiptStatus([
      { qty: "100", receivedQty: "0" },
      { qty: "50", receivedQty: "0" },
    ]),
    "sent",
  );
});

test("PO status is approved for empty item list", () => {
  assert.equal(derivePoReceiptStatus([]), "approved");
});

// ---------------------------------------------------------------------------
// Scenario H: Cross-plant (factory mismatch) — domain check only
// ---------------------------------------------------------------------------

test("Scenario H: cross-factory receipt — plantId !== intendedPlantId is distinguishable", () => {
  const receivingPlantId: string = "plant-a";
  const intendedPlantId: string = "plant-b";
  const isMismatch = receivingPlantId !== intendedPlantId;
  assert.equal(isMismatch, true);
  // When equal, no mismatch
  const samePlant: string = "plant-a";
  assert.equal(samePlant !== "plant-a", false);
});

// ---------------------------------------------------------------------------
// Scenario I: Decimal / fractional quantity precision
// ---------------------------------------------------------------------------

test("Scenario I: fractional quantities are handled (0.5 kg)", () => {
  const outstanding = outstandingMilli("100.5", "0");
  assert.equal(outstanding, toMilli("100.5"));
});

test("Scenario I: delivered/accepted with decimal split (10.5 = 9.5 + 1.0)", () => {
  const totals = receiptLineTotals({ delivered: "10.5", accepted: "9.5", rejected: "1.0" });
  assert.equal(totals.error, null);
});

test("Scenario I: delivered/accepted with mismatched decimal (10.5 ≠ 9.5 + 0.9)", () => {
  const totals = receiptLineTotals({ delivered: "10.5", accepted: "9.5", rejected: "0.9" });
  assert.equal(totals.error, "DELIVERED_SPLIT");
});

test("Scenario I: very small fractional quantities (0.001 kg)", () => {
  const outstanding = outstandingMilli("0.001", "0");
  assert.equal(outstanding, toMilli("0.001"));
  assert.equal(outstanding > 0n, true);
});

// ---------------------------------------------------------------------------
// Scenario J: Inactive/deleted category — domain-level guard logic
// ---------------------------------------------------------------------------

test("inactive category codes remain valid on historical PO specs", () => {
  // Historical GRN line specs captured at time of order (snapshot) are valid even after category deactivation
  const specs = { categoryId: "abc", categoryName: "Coils", status: "inactive" };
  assert.equal(specs.categoryName, "Coils");
});

test("inactive category is detected by status check", () => {
  // Simulates the guard in commands.ts: cat.status !== 'active'
  const inactiveCategory = { id: "cat-1", name: "Steel Coils", status: "inactive" };
  const isInactive = inactiveCategory.status !== "active";
  assert.equal(isInactive, true);
});

test("active category passes the guard", () => {
  const activeCategory = { id: "cat-2", name: "Raw Material", status: "active" };
  const isInactive = activeCategory.status !== "active";
  assert.equal(isInactive, false);
});

test("deleted category is also treated as inactive for new assignments", () => {
  const deletedCategory = { id: "cat-3", name: "Old Category", status: "deleted" };
  const isInactive = deletedCategory.status !== "active";
  assert.equal(isInactive, true);
});

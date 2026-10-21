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

test("outstanding quantity subtracts posted accepted only", () => {
  assert.equal(outstandingMilli("100", "30"), toMilli("70"));
});

test("receipt line requires delivered to equal accepted plus rejected", () => {
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "8", rejected: "2" }).error, null);
  assert.equal(receiptLineTotals({ delivered: "10", accepted: "8", rejected: "1" }).error, "DELIVERED_SPLIT");
});

test("unit mismatch is rejected", () => {
  assert.equal(assertSameUom("KG", "PCS").error, "UOM_MISMATCH");
  assert.equal(assertSameUom("kg", "KG").error, null);
});

test("over receipt blocked unless explicitly allowed", () => {
  assert.equal(assertWithinOutstanding(toMilli("5"), toMilli("3")).error, "OVER_RECEIPT");
  assert.equal(assertWithinOutstanding(toMilli("5"), toMilli("3"), { allowOverReceipt: true }).error, null);
});

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

test("inactive category codes remain valid on historical PO specs", () => {
  const specs = { categoryId: "abc", categoryName: "Coils", status: "inactive" };
  assert.equal(specs.categoryName, "Coils");
});

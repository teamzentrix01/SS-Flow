import assert from "node:assert/strict";
import test from "node:test";
import { splitConsumption, validateMaterialAllocationPlan } from "./material-allocation";

test("one job can allocate a requirement across two compatible source batches", () => {
  const plan = validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "4", allocatableQty: "8", qcPassed: true, compatible: true },
    { batchId: "batch-b", qty: "6", allocatableQty: "9", qcPassed: true, compatible: true },
  ]);
  assert.equal(plan.error, null);
  if (!plan.error) assert.equal(plan.total, "10.000");
});

test("partial allocation and partial return split consumption by source batch", () => {
  const plan = validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "4", allocatableQty: "4", qcPassed: true, compatible: true },
    { batchId: "batch-b", qty: "4", allocatableQty: "4", qcPassed: true, compatible: true },
  ]);
  assert.equal(plan.error, null);
  const result = splitConsumption([
    { id: "issue-a", batchId: "batch-a", issuedQty: "4" },
    { id: "issue-b", batchId: "batch-b", issuedQty: "4" },
  ], "6");
  assert.equal(result.error, null);
  if (!result.error) assert.deepEqual(result.rows.map(({ consumedQty, returnedQty }) => [consumedQty, returnedQty]), [["4.000", "0.000"], ["2.000", "2.000"]]);
});

test("allocation rejects oversubscription, incompatible batches, and duplicate batch rows", () => {
  assert.equal(validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "6", allocatableQty: "5", qcPassed: true, compatible: true },
  ]).error, "INSUFFICIENT_STOCK");
  assert.equal(validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "1", allocatableQty: "5", qcPassed: true, compatible: false },
  ]).error, "MATERIAL_INCOMPATIBLE");
  assert.equal(validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "1", allocatableQty: "5", qcPassed: true, compatible: true },
    { batchId: "batch-a", qty: "1", allocatableQty: "5", qcPassed: true, compatible: true },
  ]).error, "DUPLICATE_BATCH");
  assert.equal(validateMaterialAllocationPlan("10", [
    { batchId: "batch-a", qty: "6", allocatableQty: "8", qcPassed: true, compatible: true },
    { batchId: "batch-b", qty: "5", allocatableQty: "8", qcPassed: true, compatible: true },
  ]).error, "OVER_ALLOCATION");
});

test("consumption cannot exceed total issued", () => {
  assert.equal(splitConsumption([{ id: "issue-a", batchId: "batch-a", issuedQty: "2" }], "3").error, "CONSUMPTION_EXCEEDS_ISSUE");
});

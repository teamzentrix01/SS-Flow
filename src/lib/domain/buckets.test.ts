import assert from "node:assert/strict";
import test from "node:test";
import { applyMovement, emptyBuckets } from "./buckets";
import { fromMilli, toMilli } from "./qty";
import { canStartJob, predecessorsClosed, quantitiesReconcile } from "./jobs";

test("receipt then release keeps physical stock and frees available quantity", () => {
  const held = applyMovement(emptyBuckets(), "receipt", toMilli("10"));
  assert.equal(held.qcHold, toMilli("10"));
  assert.equal(held.available, 0n);
  const released = applyMovement(held, "qc_release", toMilli("10"));
  assert.equal(released.available, toMilli("10"));
  assert.equal(released.qcHold, 0n);
});

test("rejected receipt quantity is physical but never available or QC-held stock", () => {
  const buckets = applyMovement(emptyBuckets(), "receipt_reject", toMilli("2.5"));
  assert.equal(buckets.rejected, toMilli("2.5"));
  assert.equal(buckets.available, 0n);
  assert.equal(buckets.qcHold, 0n);
});

test("held stock cannot be reserved", () => {
  const held = applyMovement(emptyBuckets(), "receipt", toMilli("5"));
  assert.throws(() => applyMovement(held, "reserve", toMilli("1")), /INSUFFICIENT_STOCK/);
});

test("replayed quantities stay exact", () => {
  assert.equal(fromMilli(toMilli("12.5")), "12.500");
});

test("job output must reconcile with consumption", () => {
  assert.equal(quantitiesReconcile({ consumed: toMilli("10"), good: toMilli("9"), reject: toMilli("0.5"), scrap: toMilli("0.5") }), null);
  assert.equal(quantitiesReconcile({ consumed: toMilli("10"), good: toMilli("2"), reject: 0n, scrap: 0n }), "QTY_MISMATCH");
});

test("a successor stays locked until every predecessor is closed", () => {
  assert.equal(predecessorsClosed(["closed", "closed"]), true);
  assert.equal(predecessorsClosed(["closed", "submitted"]), false);
});

test("quality-passed intermediate output can be reserved, issued, and consumed by the next operation", () => {
  const output = applyMovement(emptyBuckets(), "output", toMilli("8"));
  const released = applyMovement(output, "qc_release", toMilli("8"));
  const reserved = applyMovement(released, "reserve", toMilli("8"));
  const issued = applyMovement(reserved, "issue", toMilli("8"));
  const consumed = applyMovement(issued, "consume", toMilli("8"));

  assert.equal(consumed.available, 0n);
  assert.equal(consumed.reserved, 0n);
  assert.equal(consumed.qcHold, 0n);
  assert.equal(consumed.wip, 0n);
});

test("inter-factory transit then destination QC-hold does not count as available", () => {
  let source = applyMovement(emptyBuckets(), "adjust", toMilli("12"));
  source = applyMovement(source, "inter_factory_dispatch_out", toMilli("12"));
  source = applyMovement(source, "inter_factory_dispatch_in", toMilli("12"));
  assert.equal(source.available, 0n);
  assert.equal(source.inTransit, toMilli("12"));
  source = applyMovement(source, "inter_factory_receive_out", toMilli("12"));
  assert.equal(source.inTransit, 0n);
  assert.equal(source.available, 0n);
  const dest = applyMovement(emptyBuckets(), "receipt", toMilli("12"));
  assert.equal(dest.qcHold, toMilli("12"));
  assert.equal(dest.available, 0n);
});

test("reserved purchased stock can be dispatched without a finished-goods bucket", () => {
  let buckets = applyMovement(emptyBuckets(), "adjust", toMilli("12"));
  buckets = applyMovement(buckets, "reserve", toMilli("12"));
  buckets = applyMovement(buckets, "dispatch_reserved", toMilli("12"));
  assert.equal(buckets.available, 0n);
  assert.equal(buckets.reserved, 0n);
  assert.equal(buckets.finished, 0n);
});

test("a corrected job can be restarted by its assigned operator", () => {
  assert.equal(
    canStartJob({
      status: "ready",
      approvalStatus: "rejected",
      assigneeId: "employee-1",
      actorEmployeeId: "employee-1",
      predecessors: ["closed"],
      machineBlocked: false,
    }),
    null,
  );
});

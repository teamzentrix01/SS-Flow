import assert from "node:assert/strict";
import test from "node:test";
import { emptyBuckets, physicalQty } from "@/lib/domain/buckets";
import { toMilli } from "@/lib/domain/qty";
import { deriveStockStatus, matchesStockStatus } from "@/modules/inventory/status";
import { parseInventoryFilters } from "@/modules/inventory/filters";

test("available-to-promise ignores QC-hold and rejected buckets", () => {
  const buckets = emptyBuckets();
  buckets.qcHold = toMilli("10");
  buckets.rejected = toMilli("2");
  buckets.available = 0n;
  assert.equal(deriveStockStatus(buckets, null), "qc_hold");
  assert.equal(matchesStockStatus("available", buckets, null), false);
  assert.equal(matchesStockStatus("qc_hold", buckets, null), true);
  assert.ok(physicalQty(buckets) > buckets.available);
});

test("low-stock uses reorder level against available quantity only", () => {
  const buckets = emptyBuckets();
  buckets.available = toMilli("4");
  buckets.reserved = toMilli("20");
  assert.equal(deriveStockStatus(buckets, toMilli("5")), "low_stock");
  assert.equal(matchesStockStatus("low_stock", buckets, toMilli("5")), true);
  assert.equal(matchesStockStatus("out_of_stock", buckets, toMilli("5")), false);
});

test("out-of-stock is available quantity at zero", () => {
  const buckets = emptyBuckets();
  buckets.wip = toMilli("3");
  assert.equal(deriveStockStatus(buckets, toMilli("1")), "out_of_stock");
});

test("factory, category, grade, and status filters parse together without dropping values", () => {
  const filters = parseInventoryFilters(
    {
      plant: "11111111-1111-1111-1111-111111111111",
      category: "22222222-2222-2222-2222-222222222222",
      grade: "304",
      status: "qc_hold",
      q: "coil",
      page: "2",
      pageSize: "50",
    },
    ["11111111-1111-1111-1111-111111111111", "33333333-3333-3333-3333-333333333333"],
  );
  assert.deepEqual(filters.plantIds, ["11111111-1111-1111-1111-111111111111"]);
  assert.equal(filters.categoryId, "22222222-2222-2222-2222-222222222222");
  assert.equal(filters.grade, "304");
  assert.equal(filters.status, "qc_hold");
  assert.equal(filters.q, "coil");
  assert.equal(filters.page, 2);
  assert.equal(filters.pageSize, 50);
});

test("a factory outside the session scope is ignored", () => {
  const filters = parseInventoryFilters({ plant: "other" }, ["plant-a"]);
  assert.deepEqual(filters.plantIds, ["plant-a"]);
  assert.equal(filters.plantId, undefined);
});

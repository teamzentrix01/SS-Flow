import assert from "node:assert/strict";
import test from "node:test";
import { explodeBomForLine, netProcurementForMaterial } from "./mrp";
import { toMilli } from "@/lib/domain/qty";

test("BOM explosion with header scrap", () => {
  const rows = explodeBomForLine("1000", "0.05", [
    { materialId: "m1", qtyPer: "0.05", lossPct: "0", uom: "KG" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.grossQty, "50.000");
});

test("net procurement subtracts available and incoming", () => {
  const need = { materialId: "m1", grossQty: "50", scrapQty: "2.5", netQty: "52.5", uom: "KG" };
  const net = netProcurementForMaterial(need, {
    materialId: "m1",
    availableQty: toMilli("18"),
    reservedOtherQty: toMilli("5"),
    incomingQty: toMilli("20"),
  }, 0n);
  assert.equal(net.netProcurement, "9.500");
});

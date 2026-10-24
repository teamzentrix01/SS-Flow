import assert from "node:assert/strict";
import test from "node:test";
import { eligiblePublicCategoryIds } from "@/modules/leads/public-catalog";

test("public enquiry categories follow active trading and manufacturing branches", () => {
  const rows = [
    { id: "trading", code: "TRADING", parentId: null, status: "active", categoryType: "raw_material" },
    { id: "coil", code: "COIL", parentId: "trading", status: "active", categoryType: "raw_material" },
    { id: "mfg", code: "MFG", parentId: null, status: "active", categoryType: "finished_goods" },
    { id: "circle", code: "CIRCLE", parentId: "mfg", status: "active", categoryType: "finished_goods" },
    { id: "inactive", code: "OLD", parentId: "trading", status: "inactive", categoryType: "raw_material" },
    { id: "scrap", code: "SCRAP", parentId: "mfg", status: "active", categoryType: "scrap" },
    { id: "consumable", code: "TOOL", parentId: "trading", status: "active", categoryType: "consumable" },
    { id: "unassigned", code: "MISC", parentId: null, status: "active", categoryType: "raw_material" },
  ];

  assert.deepEqual([...eligiblePublicCategoryIds(rows)].sort(), ["circle", "coil"]);
});

test("new active child categories become eligible without website-specific configuration", () => {
  const rows = [
    { id: "trading", code: "TRADING", parentId: null, status: "active", categoryType: "raw_material" },
    { id: "new-product-line", code: "NEW-LINE", parentId: "trading", status: "active", categoryType: "raw_material" },
  ];
  assert.deepEqual([...eligiblePublicCategoryIds(rows)], ["new-product-line"]);
});

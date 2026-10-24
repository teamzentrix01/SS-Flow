import assert from "node:assert/strict";
import test from "node:test";
import { eligiblePublicCategoryIds, productSpecifications } from "@/modules/leads/public-catalog";

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

test("public product specs use configured fields, prefer material values, and omit internal remarks", () => {
  const specifications = productSpecifications({
    productForm: "sheet",
    categoryType: "raw_material",
    productType: "raw_material",
    requiredSpecs: ["grade", "thickness"],
    grade: "SS 304",
    thickness: { toString: () => "1.5" },
    width: { toString: () => "1250" },
    length: null,
    diameter: null,
    weightPerPiece: null,
    variant: null,
    specs: { grade: "SS 201", finish: "2B", productionRemarks: "internal" },
  });
  assert.deepEqual(specifications.map((field) => field.key), ["grade", "thickness", "finish", "width"]);
  assert.equal(specifications[0].value, "SS 304");
  assert.deepEqual(specifications[0].options, ["SS 304"]);
  assert.equal(specifications[1].type, "number");
  assert.equal(specifications.find((field) => field.key === "productionRemarks"), undefined);
});

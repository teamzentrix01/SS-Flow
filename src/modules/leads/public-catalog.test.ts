import assert from "node:assert/strict";
import test from "node:test";
import {
  eligiblePublicCategoryIds,
  normalizePublicProductSpecs,
  productSpecifications,
  publicSpecificationAllowsCustomerInput,
  publicSpecificationIsNumeric,
} from "@/modules/leads/public-catalog";

test("public enquiry categories follow active trading and manufacturing branches", () => {
  const rows = [
    {
      id: "trading",
      code: "TRADING",
      parentId: null,
      status: "active",
      categoryType: "raw_material",
    },
    {
      id: "coil",
      code: "COIL",
      parentId: "trading",
      status: "active",
      categoryType: "raw_material",
    },
    {
      id: "mfg",
      code: "MFG",
      parentId: null,
      status: "active",
      categoryType: "finished_goods",
    },
    {
      id: "circle",
      code: "CIRCLE",
      parentId: "mfg",
      status: "active",
      categoryType: "finished_goods",
    },
    {
      id: "inactive",
      code: "OLD",
      parentId: "trading",
      status: "inactive",
      categoryType: "raw_material",
    },
    {
      id: "scrap",
      code: "SCRAP",
      parentId: "mfg",
      status: "active",
      categoryType: "scrap",
    },
    {
      id: "consumable",
      code: "TOOL",
      parentId: "trading",
      status: "active",
      categoryType: "consumable",
    },
    {
      id: "unassigned",
      code: "MISC",
      parentId: null,
      status: "active",
      categoryType: "raw_material",
    },
  ];

  assert.deepEqual([...eligiblePublicCategoryIds(rows)].sort(), [
    "circle",
    "coil",
  ]);
});

test("new active child categories become eligible without website-specific configuration", () => {
  const rows = [
    {
      id: "trading",
      code: "TRADING",
      parentId: null,
      status: "active",
      categoryType: "raw_material",
    },
    {
      id: "new-product-line",
      code: "NEW-LINE",
      parentId: "trading",
      status: "active",
      categoryType: "raw_material",
    },
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
  assert.deepEqual(
    specifications.map((field) => field.key),
    ["grade", "thickness", "finish", "width"],
  );
  assert.equal(specifications[0].value, "SS 304");
  assert.deepEqual(specifications[0].options, ["SS 304"]);
  assert.equal(specifications[1].type, "number");
  assert.equal(
    specifications.find((field) => field.key === "productionRemarks"),
    undefined,
  );
});

test("public product specs use material shape and expose configurable wire fields", () => {
  const specifications = productSpecifications({
    productForm: null,
    shape: "wire",
    categoryType: "raw_material",
    productType: "raw_material",
    requiredSpecs: [],
    grade: "304",
    thickness: null,
    width: null,
    length: null,
    diameter: null,
    weightPerPiece: null,
    variant: null,
    specs: {
      wireDiameterMm: "confirm per order",
      finishOrCondition: "confirm per order",
      packing: "confirm per order",
    },
  });

  const diameter = specifications.find(
    (field) => field.key === "wireDiameterMm",
  );
  assert.equal(diameter?.label, "Wire diameter");
  assert.equal(diameter?.unit, "mm");
  assert.equal(diameter?.customerInput, true);
  assert.equal(diameter?.placeholder, "confirm per order");
  assert.equal(
    publicSpecificationAllowsCustomerInput(
      "wireDiameterMm",
      "confirm per order",
    ),
    true,
  );
  assert.equal(publicSpecificationIsNumeric("wireDiameterMm"), true);
});

test("literal saved dimensions stay locked to the selected variant", () => {
  assert.equal(publicSpecificationAllowsCustomerInput("diameter", "8"), false);
  assert.equal(publicSpecificationAllowsCustomerInput("grade", "304"), false);
});

test("known seeded catalog records are repaired in the public response", () => {
  assert.deepEqual(
    normalizePublicProductSpecs("SSM-MFG-FARMA-V-304-2B-080", {
      grade: "304",
      finish: "2B",
    }),
    {
      grade: "304",
      finish: "2B",
      thickness: "0.80",
      productionRemarks: "confirm with production",
    },
  );
});

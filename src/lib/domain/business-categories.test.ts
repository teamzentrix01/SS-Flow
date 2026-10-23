import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_ROOTS,
  buildBusinessKindIndex,
  decorateCategories,
  inferBusinessKindForExistingCategory,
  inferBusinessKindForProduct,
  isAmbiguousCircleProduct,
  isBusinessRootCode,
  supplyModeAllowedForBusiness,
} from "@/lib/domain/business-categories";

test("exactly two reserved business roots exist", () => {
  assert.equal(BUSINESS_ROOTS.trading.code, "TRADING");
  assert.equal(BUSINESS_ROOTS.manufactured.code, "MFG");
  assert.equal(isBusinessRootCode("TRADING"), true);
  assert.equal(isBusinessRootCode("MFG"), true);
  assert.equal(isBusinessRootCode("STEEL-STOCK"), false);
  assert.equal(isBusinessRootCode("FG-UTENSILS"), false);
});

test("existing steel stock maps to Trading; utensils and farma map to Manufactured", () => {
  assert.equal(
    inferBusinessKindForExistingCategory({
      code: "STEEL-STOCK",
      name: "Steel Stock",
      categoryType: "raw_material",
    }),
    "trading",
  );
  assert.equal(
    inferBusinessKindForExistingCategory({
      code: "RM-COIL",
      name: "Stainless Steel Coil",
      categoryType: "raw_material",
      productForm: "coil",
    }),
    "trading",
  );
  assert.equal(
    inferBusinessKindForExistingCategory({
      code: "UTN",
      name: "Utensils",
      categoryType: "finished_goods",
      productForm: "utensil",
    }),
    "manufactured",
  );
  assert.equal(
    inferBusinessKindForProduct({
      sku: "FARMA",
      name: "Farma Design",
      productType: "semi_finished",
      supplyMode: "both",
    }),
    "manufactured",
  );
  assert.equal(
    inferBusinessKindForProduct({
      sku: "COIL",
      name: "Coil",
      productType: "raw_material",
      supplyMode: "purchased",
    }),
    "trading",
  );
});

test("Circle is flagged as ambiguous and is not locked to one supply mode", () => {
  assert.equal(isAmbiguousCircleProduct({ sku: "CIRCLE", name: "Circle", supplyMode: "both" }), true);
  assert.equal(isAmbiguousCircleProduct({ sku: "COIL", name: "Coil" }), false);
  assert.equal(supplyModeAllowedForBusiness("manufactured", "both"), true);
  assert.equal(supplyModeAllowedForBusiness("trading", "manufactured"), false);
  assert.equal(supplyModeAllowedForBusiness("manufactured", "purchased"), false);
});

test("category tree index walks to the two business roots", () => {
  const tradingId = "t1";
  const mfgId = "m1";
  const steelId = "s1";
  const sheetId = "sh1";
  const index = buildBusinessKindIndex([
    { id: tradingId, code: "TRADING", parentId: null },
    { id: mfgId, code: "MFG", parentId: null },
    { id: steelId, code: "STEEL-STOCK", parentId: tradingId },
    { id: sheetId, code: "RM-SHEET", parentId: steelId },
    { id: "u1", code: "UTN", parentId: mfgId },
  ]);
  assert.equal(index.get(tradingId), "trading");
  assert.equal(index.get(sheetId), "trading");
  assert.equal(index.get("u1"), "manufactured");
  const decorated = decorateCategories([
    { id: tradingId, code: "TRADING", parentId: null },
    { id: steelId, code: "STEEL-STOCK", parentId: tradingId },
  ]);
  assert.equal(decorated[0]?.isBusinessRoot, true);
  assert.equal(decorated[1]?.isBusinessRoot, false);
  assert.equal(decorated[1]?.businessKind, "trading");
});

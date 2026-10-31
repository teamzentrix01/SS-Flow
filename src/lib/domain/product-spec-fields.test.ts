import assert from "node:assert/strict";
import test from "node:test";
import {
  extractDesignFileIds,
  findBestVariantForSpecs,
  invalidNumericSpecFields,
  isAllowedDesignFile,
  isProductComingSoon,
  missingRequiredSpecFields,
  resolveProductFieldConfig,
  MERGED_PRODUCT_SKUS,
} from "./product-spec-fields";

test("merged catalog SKUs map retired products onto the surviving parent", () => {
  assert.equal(MERGED_PRODUCT_SKUS["SSM-TRD-WIRE-PCS"], "SSM-TRD-WIRE");
  assert.equal(MERGED_PRODUCT_SKUS["SSM-TRD-MIRROR-MATT-PVD"], "SSM-TRD-SHEET");
  assert.equal(MERGED_PRODUCT_SKUS["SSM-MFG-JUG-FARMA"], "SSM-MFG-FARMA");
});

test("Circle config is Grade, Finish, Thickness, numeric Diameter and hides Edge Type", () => {
  const config = resolveProductFieldConfig({ sku: "SSM-MFG-CIRCLE", name: "Circle" });
  assert.ok(config);
  assert.deepEqual(
    config.fields.map((field) => field.key),
    ["grade", "finish", "thickness", "diameter"],
  );
  assert.equal(config.fields.find((field) => field.key === "diameter")?.type, "number");
  assert.ok(config.hiddenKeys.includes("edgeType"));
});

test("Farma uses Length x Breadth instead of Diameter and keeps Production Remarks", () => {
  const config = resolveProductFieldConfig({ sku: "SSM-MFG-FARMA", name: "Farma" });
  assert.ok(config);
  assert.deepEqual(
    config.fields.map((field) => field.key),
    ["grade", "finish", "thickness", "length", "breadth", "productionRemarks"],
  );
  assert.equal(missingRequiredSpecFields(config, { grade: "304", finish: "2B", thickness: "0.8" }).join(","), "Length,Breadth");
  assert.equal(
    missingRequiredSpecFields(config, {
      grade: "304",
      finish: "2B",
      thickness: "0.8",
      length: "220",
      breadth: "180",
    }).length,
    0,
  );
});

test("Wire cut length is required only for cut pieces and UOM match uses product form", () => {
  const config = resolveProductFieldConfig({ sku: "SSM-TRD-WIRE", name: "Wire" });
  assert.ok(config);
  const coilMissing = missingRequiredSpecFields(config, {
    productForm: "coil",
    grade: "304",
    wireDiameterMm: "1.2",
    finishOrCondition: "bright",
  });
  assert.deepEqual(coilMissing, []);
  const cutMissing = missingRequiredSpecFields(config, {
    productForm: "cut wire piece",
    grade: "304",
    wireDiameterMm: "1.2",
    finishOrCondition: "bright",
  });
  assert.deepEqual(cutMissing, ["Cut length"]);

  const variants = [
    { id: "coil", uom: "KG", specs: { productForm: "coil", grade: "304", finishOrCondition: "bright" } },
    { id: "cut", uom: "PCS", specs: { productForm: "cut wire piece", grade: "304", finishOrCondition: "bright" } },
  ];
  const cut = findBestVariantForSpecs(
    variants,
    { productForm: "cut wire piece", grade: "316", wireDiameterMm: "2", finishOrCondition: "bright" },
    config,
  );
  assert.equal(cut?.id, "cut");
  assert.equal(cut?.uom, "PCS");
});

test("Sheet decorative subtype is optional and only shown for decorative finishes", () => {
  const config = resolveProductFieldConfig({ sku: "SSM-TRD-SHEET", name: "Sheet" });
  assert.ok(config);
  assert.equal(
    missingRequiredSpecFields(config, {
      grade: "304",
      finish: "2B",
      thickness: "0.8",
      width: "1250",
      length: "2500",
    }).length,
    0,
  );
  const decorative = config.fields.find((field) => field.key === "decorativeSubtype");
  assert.equal(decorative?.required, undefined);
  assert.ok(decorative?.showWhen?.match instanceof RegExp);
  assert.equal(decorative.showWhen.match.test("PVD"), true);
  assert.equal(decorative.showWhen.match.test("2B"), false);
});

test("Rod and Coil drop the crossed-out fields", () => {
  const rod = resolveProductFieldConfig({ sku: "SSM-TRD-ROD", name: "Rod" });
  const coil = resolveProductFieldConfig({ sku: "SSM-TRD-COIL", name: "Coil" });
  assert.ok(rod && coil);
  assert.deepEqual(rod.fields.map((field) => field.key), ["grade", "diameter", "length"]);
  assert.ok(rod.hiddenKeys.includes("packing"));
  assert.ok(coil.hiddenKeys.includes("innerDiameterMm"));
  assert.ok(coil.hiddenKeys.includes("productForm"));
  assert.ok(coil.fields.some((field) => field.key === "sizeNote"));
});

test("manual numeric values are validated without blocking newly added select options", () => {
  const config = resolveProductFieldConfig({ sku: "SSM-MFG-CIRCLE", name: "Circle" })!;
  assert.deepEqual(invalidNumericSpecFields(config, { diameter: "abc" }), ["Diameter"]);
  assert.deepEqual(invalidNumericSpecFields(config, { diameter: "300.5" }), []);
  const variant = findBestVariantForSpecs(
    [{ id: "a", uom: "PCS", specs: { grade: "304", finish: "BA", thickness: "0.80" } }],
    { grade: "321", finish: "BA", thickness: "0.80", diameter: "275" },
    config,
  );
  assert.equal(variant?.uom, "PCS");
});

test("design file type and size rules accept drawings and reject others", () => {
  assert.equal(isAllowedDesignFile({ name: "part.dxf", type: "application/octet-stream", size: 1024 }), true);
  assert.equal(isAllowedDesignFile({ name: "part.exe", type: "application/octet-stream", size: 1024 }), false);
  assert.equal(isAllowedDesignFile({ name: "huge.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }), false);
  assert.deepEqual(extractDesignFileIds({ designFileIds: ["abc"] }), ["abc"]);
});

test("Semi Finish Utensils is identified as coming soon and placeholder config exists", () => {
  assert.equal(
    isProductComingSoon({ sku: "SSM-MFG-SEMI-FINISH-UTENSILS", name: "Semi Finish Utensils" }),
    true,
  );
  assert.equal(
    isProductComingSoon({ sku: "SSM-MFG-CIRCLE", name: "Circle" }),
    false,
  );
  const config = resolveProductFieldConfig({ sku: "SSM-MFG-SEMI-FINISH-UTENSILS", name: "Semi Finish Utensils" });
  assert.ok(config);
  assert.deepEqual(
    config.fields.map((f) => f.key),
    ["grade", "stageOfManufacture", "utensilType"],
  );
});

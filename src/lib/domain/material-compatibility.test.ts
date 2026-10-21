import assert from "node:assert/strict";
import test from "node:test";
import { checkMaterialCompatibility } from "./material-compatibility";

const base = {
  requestedMaterialId: "steel-1",
  actualMaterialId: "steel-1",
  requestedSpecs: { grade: "304", thickness: "1.2", width: "1000", productForm: "coil" },
  actualSpecs: { grade: "304", thickness: "1.200", width: "1000", productForm: "coil" },
  requiredSpecs: ["grade", "thickness", "width"],
  requestedUom: "KG",
  actualUom: "KGS",
};

test("same material with exact required specs is compatible across UOM aliases", () => {
  assert.equal(checkMaterialCompatibility(base), null);
});

test("grade and dimensions are denied on mismatch or missing required measurements", () => {
  assert.equal(checkMaterialCompatibility({ ...base, actualSpecs: { ...base.actualSpecs, grade: "316" } }), "SPEC_MISMATCH");
  assert.equal(checkMaterialCompatibility({ ...base, actualSpecs: { ...base.actualSpecs, thickness: null } }), "SPEC_MISSING");
});

test("different materials require an explicit approved substitution", () => {
  assert.equal(checkMaterialCompatibility({ ...base, actualMaterialId: "steel-2" }), "SUBSTITUTION_REQUIRED");
  assert.equal(checkMaterialCompatibility({ ...base, actualMaterialId: "steel-2", actualSpecs: { ...base.actualSpecs, grade: "316" }, substitutionApproved: true }), null);
});

test("product form and UOM cannot be silently substituted", () => {
  assert.equal(checkMaterialCompatibility({ ...base, actualSpecs: { ...base.actualSpecs, productForm: "sheet" } }), "PRODUCT_FORM_MISMATCH");
  assert.equal(checkMaterialCompatibility({ ...base, actualUom: "PCS" }), "UOM_MISMATCH");
});

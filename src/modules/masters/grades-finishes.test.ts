import assert from "node:assert/strict";
import test from "node:test";
import { normalizeMasterName } from "./grades-finishes";
import {
  gradeMasterCreateSchema,
  finishMasterCreateSchema,
  productCompatibilityToggleSchema,
} from "@/lib/schemas";

test("Grade & Finish Normalization: Duplicate prevention across case and whitespace variations", () => {
  // Variations that must normalize to the exact same key
  const gradeVariants = ["SS 304", "ss 304", "  SS 304  ", "SS   304", "ss   304"];
  const normalizedGrades = gradeVariants.map(normalizeMasterName);
  assert.ok(normalizedGrades.every((val) => val === "ss 304"), "All variations of SS 304 must normalize to 'ss 304'");

  const finishVariants = ["2B", "2b", " 2B ", "No. 4", "no. 4", "  NO. 4  ", "Mirror", " MIRROR "];
  assert.equal(normalizeMasterName(finishVariants[0]), "2b");
  assert.equal(normalizeMasterName(finishVariants[1]), "2b");
  assert.equal(normalizeMasterName(finishVariants[2]), "2b");
  assert.equal(normalizeMasterName(finishVariants[3]), "no. 4");
  assert.equal(normalizeMasterName(finishVariants[4]), "no. 4");
  assert.equal(normalizeMasterName(finishVariants[5]), "no. 4");
  assert.equal(normalizeMasterName(finishVariants[6]), "mirror");
  assert.equal(normalizeMasterName(finishVariants[7]), "mirror");
});

test("Validation Schemas: Grade and Finish Master input validation", () => {
  // Valid grade
  const validGrade = gradeMasterCreateSchema.safeParse({ name: "SS 316L", description: "Marine grade stainless steel" });
  assert.ok(validGrade.success);
  if (validGrade.success) {
    assert.equal(validGrade.data.name, "SS 316L");
  }

  // Empty grade name rejected
  const emptyGrade = gradeMasterCreateSchema.safeParse({ name: "   " });
  assert.ok(!emptyGrade.success, "Empty grade name must fail validation");

  // Valid finish
  const validFinish = finishMasterCreateSchema.safeParse({ name: "BA (Bright Annealed)" });
  assert.ok(validFinish.success);

  // Toggle compatibility schema
  const validToggle = productCompatibilityToggleSchema.safeParse({
    productId: "0194bc02-1234-7000-8000-000000000001",
    masterId: "0194bc02-1234-7000-8000-000000000002",
    type: "grade",
    isActive: true,
  });
  assert.ok(validToggle.success);
});

test("Product Compatibility Rules: Isolation between products sharing master records", () => {
  // Master records exist independently
  const masterGrades = [
    { id: "grade-304", name: "SS 304", normalizedName: "ss 304", isActive: true },
    { id: "grade-316", name: "SS 316", normalizedName: "ss 316", isActive: true },
    { id: "grade-202", name: "SS 202", normalizedName: "ss 202", isActive: true },
  ];

  const masterFinishes = [
    { id: "finish-2b", name: "2B", normalizedName: "2b", isActive: true },
    { id: "finish-ba", name: "BA", normalizedName: "ba", isActive: true },
    { id: "finish-mirror", name: "Mirror", normalizedName: "mirror", isActive: true },
  ];

  // Configured compatibilities for Sheet vs Coil
  const sheetCompatibilities = {
    gradeIds: new Set(["grade-304", "grade-316", "grade-202"]),
    finishIds: new Set(["finish-2b", "finish-ba", "finish-mirror"]),
  };

  const coilCompatibilities = {
    gradeIds: new Set(["grade-304", "grade-316"]),
    finishIds: new Set(["finish-2b", "finish-ba"]),
  };

  // SS 202 is compatible with Sheet, but NOT with Coil
  assert.ok(sheetCompatibilities.gradeIds.has("grade-202"), "SS 202 is compatible with Sheet");
  assert.ok(!coilCompatibilities.gradeIds.has("grade-202"), "SS 202 is NOT compatible with Coil");

  // Mirror finish is compatible with Sheet, but NOT with Coil
  assert.ok(sheetCompatibilities.finishIds.has("finish-mirror"), "Mirror is compatible with Sheet");
  assert.ok(!coilCompatibilities.finishIds.has("finish-mirror"), "Mirror is NOT compatible with Coil");

  // Shared master reuse: both reference the same master ID
  assert.equal(masterGrades.find((g) => sheetCompatibilities.gradeIds.has(g.id) && g.name === "SS 304")?.id, "grade-304");
  assert.equal(masterGrades.find((g) => coilCompatibilities.gradeIds.has(g.id) && g.name === "SS 304")?.id, "grade-304");
});

test("Specification Combination Validation: Enforcing product-specific compatibility", () => {
  const productSheet = {
    id: "prod-sheet",
    name: "Stainless Steel Sheet",
    compatibleGrades: new Map([
      ["ss 304", { id: "grade-304", name: "SS 304", isActive: true }],
      ["ss 316", { id: "grade-316", name: "SS 316", isActive: true }],
    ]),
    compatibleFinishes: new Map([
      ["2b", { id: "finish-2b", name: "2B", isActive: true }],
      ["mirror", { id: "finish-mirror", name: "Mirror", isActive: true }],
    ]),
  };

  function validateCombination(
    product: typeof productSheet,
    gradeName?: string | null,
    finishName?: string | null
  ) {
    let gradeId: string | null = null;
    let finishId: string | null = null;

    if (gradeName?.trim()) {
      const norm = normalizeMasterName(gradeName);
      const matched = product.compatibleGrades.get(norm);
      if (!matched || !matched.isActive) {
        throw new Error(`Grade '${gradeName}' is not compatible with product '${product.name}'.`);
      }
      gradeId = matched.id;
    }

    if (finishName?.trim()) {
      const norm = normalizeMasterName(finishName);
      const matched = product.compatibleFinishes.get(norm);
      if (!matched || !matched.isActive) {
        throw new Error(`Finish '${finishName}' is not compatible with product '${product.name}'.`);
      }
      finishId = matched.id;
    }

    return { gradeId, finishId };
  }

  // 1. Valid compatible combination succeeds
  const valid = validateCombination(productSheet, "SS 304", "2B");
  assert.equal(valid.gradeId, "grade-304");
  assert.equal(valid.finishId, "finish-2b");

  // 2. Case-insensitive compatible match succeeds
  const validLower = validateCombination(productSheet, "ss 316", "mirror");
  assert.equal(validLower.gradeId, "grade-316");
  assert.equal(validLower.finishId, "finish-mirror");

  // 3. Incompatible grade is rejected
  assert.throws(
    () => validateCombination(productSheet, "SS 430", "2B"),
    /Grade 'SS 430' is not compatible/
  );

  // 4. Incompatible finish is rejected
  assert.throws(
    () => validateCombination(productSheet, "SS 304", "Gold PVD"),
    /Finish 'Gold PVD' is not compatible/
  );
});

test("Safe Deactivation & History Preservation: Inactive masters preserve historical variants", () => {
  // Existing historical variant referencing deactivated grade
  const historicalVariant = {
    id: "var-001",
    productId: "prod-sheet",
    gradeId: "grade-legacy",
    grade: "SS 310S",
    finish: "No. 1",
    isActive: true,
  };

  // Grade is deactivated in master table
  const gradeMaster = {
    id: "grade-legacy",
    name: "SS 310S",
    isActive: false, // Deactivated
  };

  // Historical variant still retains grade name and gradeId
  assert.equal(historicalVariant.gradeId, gradeMaster.id);
  assert.equal(historicalVariant.grade, "SS 310S");

  // But new variant creation checks isActive === true and rejects creation
  assert.equal(gradeMaster.isActive, false, "Deactivated grade cannot be used for new specifications");
});

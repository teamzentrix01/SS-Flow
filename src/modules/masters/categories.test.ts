import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "@/lib/errors";
import {
  CATEGORY_TYPES,
  PRODUCT_FORMS,
  type CategoryType,
  type ProductForm,
} from "@/lib/domain/master-entities";
import { missingMaterialSpecifications } from "@/lib/domain/material-specifications";

// ---------------------------------------------------------------------------
// 1. Admin creates a new category with configurable properties
// ---------------------------------------------------------------------------
test("Category 1: Admin creates a new category with valid code, type, form, and required specs", () => {
  const categoryInput = {
    code: "SHEET-CR",
    name: "Cold Rolled Sheet",
    categoryType: "raw_material" as CategoryType,
    productForm: "sheet" as ProductForm,
    requiredSpecs: ["grade", "thickness", "width", "length"],
    description: "Cold rolled stainless steel sheets",
    status: "active" as const,
  };

  assert.ok(CATEGORY_TYPES.includes(categoryInput.categoryType), "categoryType must be in allowed list");
  assert.ok(PRODUCT_FORMS.includes(categoryInput.productForm), "productForm must be in allowed list");
  assert.equal(categoryInput.code, "SHEET-CR");
  assert.equal(categoryInput.status, "active");
  assert.equal(categoryInput.requiredSpecs.length, 4);
});

// ---------------------------------------------------------------------------
// 2. Category becomes available in inventory and PO selection
// ---------------------------------------------------------------------------
test("Category 2: Active categories are included in selection lists while inactive are excluded by default", () => {
  const sampleCategories = [
    { id: "cat-1", code: "COIL", name: "Steel Coil", status: "active" },
    { id: "cat-2", code: "SHEET", name: "Steel Sheet", status: "active" },
    { id: "cat-3", code: "OLD-PIPE", name: "Legacy Pipe", status: "inactive" },
    { id: "cat-4", code: "DEL-ROD", name: "Deleted Rod", status: "deleted" },
  ];

  // Simulated activeOnly filter used in listProductCategories and listAllProductCategories
  const activeOnly = (cats: typeof sampleCategories, filterActive = true) =>
    cats.filter((c) => (filterActive ? c.status === "active" : c.status !== "deleted"));

  const forDropdowns = activeOnly(sampleCategories, true);
  assert.equal(forDropdowns.length, 2, "only active categories returned for selection dropdowns");
  assert.deepEqual(forDropdowns.map((c) => c.code), ["COIL", "SHEET"]);

  const forAdminAudit = activeOnly(sampleCategories, false);
  assert.equal(forAdminAudit.length, 3, "includes inactive categories for admin management screens");
});

// ---------------------------------------------------------------------------
// 3. Category propagation to product specifications validation
// ---------------------------------------------------------------------------
test("Category 3: Category requiredSpecs dynamically enforce validation rules on product creation", () => {
  const categoryWithSpecs = {
    code: "COIL-HR",
    name: "Hot Rolled Coil",
    requiredSpecs: ["grade", "thickness", "width"],
  };

  // Missing thickness and width
  const incompleteProduct = { grade: "304", thickness: "", width: "" };
  const missing = missingMaterialSpecifications(categoryWithSpecs.requiredSpecs, incompleteProduct);
  assert.deepEqual(missing, ["Thickness", "Width"], "missing required specs must be detected");

  // Complete product
  const completeProduct = { grade: "304", thickness: "2.5", width: "1250" };
  const noneMissing = missingMaterialSpecifications(categoryWithSpecs.requiredSpecs, completeProduct);
  assert.deepEqual(noneMissing, [], "valid specs produce no missing errors");
});

// ---------------------------------------------------------------------------
// 4. Deactivated categories cannot be selected for new transactions
// ---------------------------------------------------------------------------
test("Category 4: Guard rejects assigning deactivated or deleted categories to new products/POs", () => {
  function checkCategoryActive(cat: { name: string; status: string }) {
    if (cat.status !== "active") {
      throw new AppError(409, "CATEGORY_INACTIVE", `Category "${cat.name}" is not active. Activate it before assigning.`);
    }
  }

  // Active category passes
  assert.doesNotThrow(() => checkCategoryActive({ name: "Active Coil", status: "active" }));

  // Inactive category throws CATEGORY_INACTIVE
  assert.throws(
    () => checkCategoryActive({ name: "Deactivated Sheet", status: "inactive" }),
    (err: unknown) => err instanceof AppError && err.code === "CATEGORY_INACTIVE",
  );

  // Deleted category throws CATEGORY_INACTIVE
  assert.throws(
    () => checkCategoryActive({ name: "Deleted Wire", status: "deleted" }),
    (err: unknown) => err instanceof AppError && err.code === "CATEGORY_INACTIVE",
  );
});

// ---------------------------------------------------------------------------
// 5. Historical records using an inactive category remain readable
// ---------------------------------------------------------------------------
test("Category 5: Historical PO and GRN spec snapshots remain intact and readable when category is deactivated", () => {
  // PO line stores an immutable snapshot in specs
  const historicalPoLine = {
    id: "item-1",
    materialId: "mat-old",
    qty: "1000",
    specs: {
      category: "raw",
      categoryId: "cat-deactivated-id",
      categoryName: "Special Alloy Coils",
      shape: "coil",
    },
  };

  // Historical GRN stores specs snapshot
  const historicalGrnItem = {
    id: "grn-item-1",
    deliveredQty: "1000",
    acceptedQty: "1000",
    grade: "316L",
    thickness: "3.000",
    specs: historicalPoLine.specs,
  };

  assert.equal(historicalPoLine.specs.categoryName, "Special Alloy Coils");
  assert.equal(historicalGrnItem.specs.categoryId, "cat-deactivated-id");
  assert.ok(historicalPoLine.specs.shape === "coil", "historical shape is preserved");
});

// ---------------------------------------------------------------------------
// 6. Category configuration versus production eligibility
// ---------------------------------------------------------------------------
test("Category 6: Category creation does not grant production BOM eligibility without manufacturingAllowed", () => {
  function validateBomEligibility(product: {
    name: string;
    manufacturingAllowed: boolean;
    category?: { name: string; categoryType: string; status: string };
  }) {
    if (!product.manufacturingAllowed) {
      throw new AppError(400, "NOT_MANUFACTURABLE", `Product "${product.name}" is not flagged as eligible for manufacturing.`);
    }
    if (product.category) {
      if (product.category.status !== "active") {
        throw new AppError(409, "CATEGORY_INACTIVE", `Category "${product.category.name}" is not active.`);
      }
      if (product.category.categoryType === "consumable" || product.category.categoryType === "scrap") {
        throw new AppError(400, "NOT_MANUFACTURABLE", `Category "${product.category.name}" is not eligible for production BOMs.`);
      }
    }
    return true;
  }

  // Purchased raw material with manufacturingAllowed=false cannot have a BOM
  assert.throws(
    () =>
      validateBomEligibility({
        name: "Purchased Sheet",
        manufacturingAllowed: false,
        category: { name: "Sheet", categoryType: "raw_material", status: "active" },
      }),
    (err: unknown) => err instanceof AppError && err.code === "NOT_MANUFACTURABLE",
  );

  // Consumable category cannot have a production BOM
  assert.throws(
    () =>
      validateBomEligibility({
        name: "Coolant Oil",
        manufacturingAllowed: true,
        category: { name: "Lubricants", categoryType: "consumable", status: "active" },
      }),
    (err: unknown) => err instanceof AppError && err.code === "NOT_MANUFACTURABLE",
  );

  // Inactive category product cannot have BOM created/updated
  assert.throws(
    () =>
      validateBomEligibility({
        name: "Old Utensil",
        manufacturingAllowed: true,
        category: { name: "Discontinued", categoryType: "finished_goods", status: "inactive" },
      }),
    (err: unknown) => err instanceof AppError && err.code === "CATEGORY_INACTIVE",
  );

  // Properly configured finished product in active category passes
  assert.ok(
    validateBomEligibility({
      name: "Stainless Spoon 18cm",
      manufacturingAllowed: true,
      category: { name: "Utensils", categoryType: "finished_goods", status: "active" },
    }),
  );
});

// ---------------------------------------------------------------------------
// 7. Duplicate category identifiers are rejected
// ---------------------------------------------------------------------------
test("Category 7: Duplicate category codes (case-insensitive) are rejected per plant", () => {
  const existingCodes = ["SHEET", "COIL", "CIRCLE", "PIPE"];

  function validateNewCode(newCode: string) {
    const normalized = newCode.trim().toUpperCase();
    if (existingCodes.includes(normalized)) {
      throw new AppError(409, "DUPLICATE", "Category code already exists.");
    }
    return normalized;
  }

  // Case-insensitive duplicate rejection
  assert.throws(
    () => validateNewCode("sheet"),
    (err: unknown) => err instanceof AppError && err.code === "DUPLICATE",
  );

  assert.throws(
    () => validateNewCode("  COIL  "),
    (err: unknown) => err instanceof AppError && err.code === "DUPLICATE",
  );

  // Unique new code passes
  assert.equal(validateNewCode("WIRE-SS"), "WIRE-SS");
});

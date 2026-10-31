import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSpecValue,
  isNumericSpecField,
  NUMERIC_SPEC_FIELDS,
} from "./spec-options";
import { specOptionCreateSchema } from "@/lib/schemas";

test("Spec Option Normalization: Text and Numeric normalization rules", () => {
  // Text specs normalize lowercase and trim multiple spaces
  assert.equal(normalizeSpecValue("  SS  304  ", "grade"), "ss 304");
  assert.equal(normalizeSpecValue("MIRROR", "finish"), "mirror");
  assert.equal(normalizeSpecValue(" Rose  Gold ", "pvdColour"), "rose gold");

  // Numeric specs normalize to standardized decimal numbers
  assert.equal(normalizeSpecValue("1.50", "thickness"), "1.5");
  assert.equal(normalizeSpecValue(" 0300 ", "diameter"), "300");
  assert.equal(normalizeSpecValue("0.800", "thickness"), "0.8");
  assert.equal(normalizeSpecValue("2.0", "width"), "2");
});

test("Numeric Spec Fields: Identification and type checks", () => {
  assert.ok(isNumericSpecField("thickness"));
  assert.ok(isNumericSpecField("diameter"));
  assert.ok(isNumericSpecField("width"));
  assert.ok(isNumericSpecField("length"));
  assert.ok(isNumericSpecField("size"));
  assert.ok(isNumericSpecField("wireDiameterMm"));
  assert.ok(isNumericSpecField("capacityLitres"));

  assert.ok(!isNumericSpecField("grade"));
  assert.ok(!isNumericSpecField("finish"));
  assert.ok(!isNumericSpecField("pvdColour"));
  assert.ok(!isNumericSpecField("materialFamily"));
});

test("Validation Schemas: Spec Option input validation and duplicate prevention", () => {
  // Valid thickness option
  const validThickness = specOptionCreateSchema.safeParse({
    fieldName: "thickness",
    value: "1.25",
    unit: "mm",
  });
  assert.ok(validThickness.success);

  // Valid diameter option
  const validDiameter = specOptionCreateSchema.safeParse({
    fieldName: "diameter",
    value: "250",
    unit: "mm",
    description: "Standard circle blank diameter",
  });
  assert.ok(validDiameter.success);

  // Empty value rejected
  const emptyValue = specOptionCreateSchema.safeParse({
    fieldName: "thickness",
    value: "   ",
  });
  assert.ok(!emptyValue.success, "Empty value must fail validation");

  // Empty fieldName rejected
  const emptyField = specOptionCreateSchema.safeParse({
    fieldName: "  ",
    value: "2.0",
  });
  assert.ok(!emptyField.success, "Empty fieldName must fail validation");
});

test("Duplicate Detection Logic: Matching existing values case-insensitively", () => {
  const existingOptions = [
    { fieldName: "thickness", value: "1.5", normalizedValue: "1.5" },
    { fieldName: "diameter", value: "300", normalizedValue: "300" },
    { fieldName: "grade", value: "SS 304", normalizedValue: "ss 304" },
  ];

  function findDuplicate(fieldName: string, inputVal: string) {
    const norm = normalizeSpecValue(inputVal, fieldName);
    return existingOptions.find(
      (opt) => opt.fieldName === fieldName && opt.normalizedValue === norm
    );
  }

  // Exactly matching or whitespace/case variants detect the duplicate
  assert.ok(findDuplicate("thickness", "1.5"));
  assert.ok(findDuplicate("thickness", " 1.50 "));
  assert.ok(findDuplicate("diameter", "300"));
  assert.ok(findDuplicate("diameter", " 0300 "));
  assert.ok(findDuplicate("grade", "ss 304"));
  assert.ok(findDuplicate("grade", "  SS   304  "));

  // Truly new values are not flagged as duplicates
  assert.equal(findDuplicate("thickness", "1.75"), undefined);
  assert.equal(findDuplicate("diameter", "350"), undefined);
  assert.equal(findDuplicate("grade", "SS 316L"), undefined);
});

test("Natural Sorting for Spec Options: Numeric, grade, and alphabetical", () => {
  function compareSpec(a: string, b: string, fieldName: string) {
    if (NUMERIC_SPEC_FIELDS.has(fieldName)) {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  // Numeric thickness sorts numerically
  const thicknesses = ["1.5", "0.4", "2.0", "0.8", "1.0", "10", "3.0"];
  thicknesses.sort((a, b) => compareSpec(a, b, "thickness"));
  assert.deepEqual(thicknesses, ["0.4", "0.8", "1.0", "1.5", "2.0", "3.0", "10"]);

  // Diameters sort numerically
  const diameters = ["200", "50", "500", "100", "1000", "350"];
  diameters.sort((a, b) => compareSpec(a, b, "diameter"));
  assert.deepEqual(diameters, ["50", "100", "200", "350", "500", "1000"]);

  // Grades sort naturally (201, 304, 316, 430)
  const grades = ["SS 316", "SS 201", "SS 430", "SS 304", "SS 316L"];
  grades.sort((a, b) => compareSpec(a, b, "grade"));
  assert.deepEqual(grades, ["SS 201", "SS 304", "SS 316", "SS 316L", "SS 430"]);

  // PVD colours sort alphabetically
  const colours = ["Rose Gold", "Gold", "Black", "Bronze", "Copper"];
  colours.sort((a, b) => compareSpec(a, b, "pvdColour"));
  assert.deepEqual(colours, ["Black", "Bronze", "Copper", "Gold", "Rose Gold"]);
});


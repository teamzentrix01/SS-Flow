import assert from "node:assert/strict";
import test from "node:test";
import { missingMaterialSpecifications } from "./material-specifications";

test("category rules require only configured steel fields", () => {
  assert.deepEqual(
    missingMaterialSpecifications(["grade", "thickness", "width"], { grade: "304", thickness: "0.8" }),
    ["Width"],
  );
  assert.deepEqual(missingMaterialSpecifications(["grade"], { grade: "304" }), []);
});

test("uncategorized and legacy categories without rules remain valid", () => {
  assert.deepEqual(missingMaterialSpecifications([], {}), []);
  assert.deepEqual(missingMaterialSpecifications(["future_key"], {}), []);
});

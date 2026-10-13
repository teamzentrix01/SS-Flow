/** Product category type — classification only (not inventory buckets). */
export const CATEGORY_TYPES = [
  "raw_material",
  "wip",
  "finished_goods",
  "consumable",
  "scrap",
] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const PRODUCT_FORMS = ["coil", "sheet", "utensil", "component", "other"] as const;
export type ProductForm = (typeof PRODUCT_FORMS)[number];

export const PRODUCT_TYPES = [
  "raw_material",
  "semi_finished",
  "finished",
  "consumable",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** Legacy material_masters.category codes kept for steel + utensil flows. */
export const LEGACY_MATERIAL_CATEGORIES = ["raw", "semi", "utensil", "consumable"] as const;
export type LegacyMaterialCategory = (typeof LEGACY_MATERIAL_CATEGORIES)[number];

export const EMPLOYMENT_TYPES = ["permanent", "contract", "trainee"] as const;
export const EMPLOYMENT_STATUSES = ["active", "inactive", "on_leave"] as const;
export const SKILL_LEVELS = ["trainee", "skilled", "expert"] as const;

export const JOB_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export function legacyCategoryFromProductType(productType: ProductType): LegacyMaterialCategory {
  switch (productType) {
    case "raw_material":
      return "raw";
    case "semi_finished":
      return "semi";
    case "consumable":
      return "consumable";
    default:
      return "utensil";
  }
}

export function productTypeFromLegacyCategory(category: string): ProductType {
  switch (category) {
    case "raw":
      return "raw_material";
    case "semi":
      return "semi_finished";
    case "consumable":
      return "consumable";
    default:
      return "finished";
  }
}

export function defaultCategoryTypeForProductType(productType: ProductType): CategoryType {
  switch (productType) {
    case "raw_material":
      return "raw_material";
    case "semi_finished":
      return "wip";
    case "consumable":
      return "consumable";
    default:
      return "finished_goods";
  }
}

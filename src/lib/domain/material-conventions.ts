/** Material master category conventions for SS-Flow (steel + utensils). */
export const MATERIAL_CATEGORIES = ["raw", "semi", "utensil", "consumable"] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

/** Raw coil/sheet stock is tracked in KG via batches. Utensil FG uses PCS in the same bucket fields. */
export const CATEGORY_UOM_DEFAULT: Record<MaterialCategory, string> = {
  raw: "KG",
  semi: "KG",
  utensil: "PCS",
  consumable: "KG",
};

export function defaultUomForCategory(category: string): string {
  if (MATERIAL_CATEGORIES.includes(category as MaterialCategory)) {
    return CATEGORY_UOM_DEFAULT[category as MaterialCategory];
  }
  return "KG";
}

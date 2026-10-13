/** Material master category conventions for SS-Flow (steel + utensils). */
export {
  LEGACY_MATERIAL_CATEGORIES as MATERIAL_CATEGORIES,
  type LegacyMaterialCategory as MaterialCategory,
} from "@/lib/domain/master-entities";
import type { LegacyMaterialCategory as MaterialCategory } from "@/lib/domain/master-entities";
import { LEGACY_MATERIAL_CATEGORIES } from "@/lib/domain/master-entities";

/** Raw coil/sheet stock is tracked in KG via batches. Utensil FG uses PCS in the same bucket fields. */
export const CATEGORY_UOM_DEFAULT: Record<MaterialCategory, string> = {
  raw: "KG",
  semi: "KG",
  utensil: "PCS",
  consumable: "KG",
};

export function defaultUomForCategory(category: string): string {
  if (LEGACY_MATERIAL_CATEGORIES.includes(category as MaterialCategory)) {
    return CATEGORY_UOM_DEFAULT[category as MaterialCategory];
  }
  return "KG";
}

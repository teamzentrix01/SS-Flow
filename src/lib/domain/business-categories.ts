/** Top-level commercial grouping. Inventory types (raw, WIP, FG) remain subcategories. */
export const BUSINESS_KIND = {
  trading: "trading",
  manufactured: "manufactured",
} as const;

export type BusinessKind = (typeof BUSINESS_KIND)[keyof typeof BUSINESS_KIND];

export const BUSINESS_ROOTS = {
  trading: {
    kind: BUSINESS_KIND.trading,
    code: "TRADING",
    name: "Trading Products",
    subtitle: "Purchased from suppliers and resold",
    description: "Products purchased from suppliers and resold or supplied to customers.",
    categoryType: "raw_material" as const,
  },
  manufactured: {
    kind: BUSINESS_KIND.manufactured,
    code: "MFG",
    name: "Manufactured Products",
    subtitle: "Made or processed in our factory",
    description: "Products manufactured or processed by SS-Metals in its factory.",
    categoryType: "finished_goods" as const,
  },
} as const;

export const BUSINESS_ROOT_CODES = [BUSINESS_ROOTS.trading.code, BUSINESS_ROOTS.manufactured.code] as const;

export type CategoryTreeNode = {
  id?: string;
  code: string;
  name?: string;
  parentId?: string | null;
  parent?: CategoryTreeNode | null;
  categoryType?: string;
  productForm?: string | null;
};

const TRADING_CODES = new Set([
  "TRADING",
  "STEEL-STOCK",
  "RM",
  "RM-COIL",
  "RM-SHEET",
  "CON",
  "CON-WELD",
  "HELLO09",
  "TEST-CATEGORY",
]);

const MANUFACTURED_CODES = new Set([
  "MFG",
  "SEMI-FG",
  "SFG",
  "SFG-BLANK",
  "SFG-STRIP",
  "FG",
  "FG-UTENSILS",
  "UTN",
  "SCRAP",
]);

const TRADING_NAME = /\b(coil|sheet|wire|rod|pipe|mirror|matt|pvd)\b/i;
const MANUFACTURED_NAME = /\b(farma|utensil|jug|canister|bucket|bhojan|blank|laser)\b/i;

export function isBusinessRootCode(code: string) {
  return BUSINESS_ROOT_CODES.includes(code.trim().toUpperCase() as (typeof BUSINESS_ROOT_CODES)[number]);
}

export function businessKindFromCode(code: string): BusinessKind | null {
  const normalized = code.trim().toUpperCase();
  if (normalized === BUSINESS_ROOTS.trading.code) return BUSINESS_KIND.trading;
  if (normalized === BUSINESS_ROOTS.manufactured.code) return BUSINESS_KIND.manufactured;
  return null;
}

export function businessKindLabel(kind: BusinessKind | null | undefined) {
  if (kind === BUSINESS_KIND.trading) return BUSINESS_ROOTS.trading.name;
  if (kind === BUSINESS_KIND.manufactured) return BUSINESS_ROOTS.manufactured.name;
  return "Unassigned";
}

/** Walk parent chain until a TRADING/MFG root is found. */
export function businessKindFromCategory(category: CategoryTreeNode | null | undefined): BusinessKind | null {
  const seen = new Set<string>();
  let current: CategoryTreeNode | null | undefined = category;
  while (current) {
    const key = current.id ?? current.code;
    if (seen.has(key)) break;
    seen.add(key);
    const fromCode = businessKindFromCode(current.code);
    if (fromCode) return fromCode;
    current = current.parent ?? null;
  }
  return null;
}

export function inferBusinessKindForExistingCategory(category: {
  code: string;
  name: string;
  categoryType: string;
  productForm?: string | null;
}): BusinessKind {
  const code = category.code.trim().toUpperCase();
  const fromCode = businessKindFromCode(code);
  if (fromCode) return fromCode;
  if (TRADING_CODES.has(code)) return BUSINESS_KIND.trading;
  if (MANUFACTURED_CODES.has(code)) return BUSINESS_KIND.manufactured;
  if (TRADING_NAME.test(category.name) || TRADING_NAME.test(category.productForm ?? "")) return BUSINESS_KIND.trading;
  if (MANUFACTURED_NAME.test(category.name) || MANUFACTURED_NAME.test(category.productForm ?? "")) {
    return BUSINESS_KIND.manufactured;
  }
  if (category.categoryType === "raw_material" || category.categoryType === "consumable") return BUSINESS_KIND.trading;
  if (category.categoryType === "wip" || category.categoryType === "finished_goods" || category.categoryType === "scrap") {
    return BUSINESS_KIND.manufactured;
  }
  return BUSINESS_KIND.trading;
}

export function inferBusinessKindForProduct(product: {
  sku: string;
  name: string;
  productType: string;
  supplyMode: string;
  category?: CategoryTreeNode | null;
}): BusinessKind {
  const fromCategory = businessKindFromCategory(product.category);
  if (fromCategory) return fromCategory;
  const sku = product.sku.trim().toUpperCase();
  if (["COIL", "SHEET", "WIRE", "ROD", "PIPE"].includes(sku)) return BUSINESS_KIND.trading;
  if (["FARMA", "BLANK", "UTENSILS"].includes(sku)) return BUSINESS_KIND.manufactured;
  if (product.supplyMode === "purchased" || product.productType === "raw_material" || product.productType === "consumable") {
    return BUSINESS_KIND.trading;
  }
  return BUSINESS_KIND.manufactured;
}

/** Circle is processed in-house and also traded; do not lock supply mode. */
export function isAmbiguousCircleProduct(product: { sku: string; name: string; supplyMode?: string }) {
  const sku = product.sku.trim().toUpperCase();
  const name = product.name.trim().toLowerCase();
  return sku === "CIRCLE" || name === "circle";
}

export function defaultSupplyModeForBusiness(kind: BusinessKind): "purchased" | "manufactured" {
  return kind === BUSINESS_KIND.trading ? "purchased" : "manufactured";
}

export function supplyModeAllowedForBusiness(kind: BusinessKind, supplyMode: string) {
  if (kind === BUSINESS_KIND.trading) return supplyMode === "purchased" || supplyMode === "both";
  return supplyMode === "manufactured" || supplyMode === "both";
}

export function buildBusinessKindIndex(
  categories: { id: string; code: string; parentId: string | null }[],
): Map<string, BusinessKind | null> {
  const byId = new Map(categories.map((row) => [row.id, row]));
  const index = new Map<string, BusinessKind | null>();

  function kindFor(id: string): BusinessKind | null {
    if (index.has(id)) return index.get(id) ?? null;
    const row = byId.get(id);
    if (!row) {
      index.set(id, null);
      return null;
    }
    const direct = businessKindFromCode(row.code);
    if (direct) {
      index.set(id, direct);
      return direct;
    }
    if (!row.parentId) {
      index.set(id, null);
      return null;
    }
    // Prevent cycles while walking.
    index.set(id, null);
    const parentKind = kindFor(row.parentId);
    index.set(id, parentKind);
    return parentKind;
  }

  for (const row of categories) kindFor(row.id);
  return index;
}

export function decorateCategories<T extends { id: string; code: string; parentId: string | null }>(rows: T[]) {
  const index = buildBusinessKindIndex(rows);
  return rows.map((row) => ({
    ...row,
    businessKind: index.get(row.id) ?? null,
    isBusinessRoot: isBusinessRootCode(row.code),
  }));
}

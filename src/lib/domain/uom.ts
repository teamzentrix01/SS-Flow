import { fromMilli, toMilli } from "@/lib/domain/qty";

const MASS_IN_KG: Record<string, bigint> = {
  KG: 1n,
  KGS: 1n,
  KILOGRAM: 1n,
  T: 1000n,
  MT: 1000n,
  TON: 1000n,
  TONNE: 1000n,
};

export function normalizeUom(value: string) {
  const unit = value.trim().toUpperCase();
  if (unit === "KGS" || unit === "KILOGRAM") return "KG";
  if (unit === "T" || unit === "MT" || unit === "TON" || unit === "TONNE") return "T";
  return unit;
}

/** Convert only identical units or mass units. Count-to-weight needs a separately measured quantity. */
export function convertQuantity(value: string, fromUom: string, toUom: string): string | null {
  const from = normalizeUom(fromUom);
  const to = normalizeUom(toUom);
  const quantity = toMilli(value);
  if (from === to) return fromMilli(quantity);

  const fromKg = MASS_IN_KG[from];
  const toKg = MASS_IN_KG[to];
  if (!fromKg || !toKg) return null;

  const numerator = quantity * fromKg;
  if (numerator % toKg !== 0n) return null;
  return fromMilli(numerator / toKg);
}

export function isMassUom(value: string) {
  return MASS_IN_KG[normalizeUom(value)] !== undefined;
}

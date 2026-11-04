export function quotationValidityDays() {
  const raw = Number(process.env.QUOTATION_VALIDITY_DAYS ?? "1");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
}

export function quotationMaxDiscountPct() {
  const raw = Number(process.env.QUOTATION_MAX_DISCOUNT_PCT ?? "10");
  return Number.isFinite(raw) && raw >= 0 ? raw : 10;
}

export function defaultValidUntil(from = new Date()) {
  const end = new Date(from);
  end.setDate(end.getDate() + quotationValidityDays());
  return end;
}

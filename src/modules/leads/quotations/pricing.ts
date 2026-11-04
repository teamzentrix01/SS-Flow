import { quotationMaxDiscountPct } from "@/modules/leads/quotations/config";

export type QuotationLineInput = {
  listRate?: string | null;
  rate: string;
};

export function lineDiscountPct(listRate: number, rate: number) {
  if (!Number.isFinite(listRate) || listRate <= 0) return 0;
  if (!Number.isFinite(rate) || rate < 0) return 0;
  const pct = ((listRate - rate) / listRate) * 100;
  return Math.max(0, Math.round(pct * 1000) / 1000);
}

export function quotationNeedsDiscountApproval(lines: QuotationLineInput[]) {
  const limit = quotationMaxDiscountPct();
  for (const line of lines) {
    const list = Number(line.listRate ?? 0);
    const rate = Number(line.rate);
    if (!list || !Number.isFinite(rate)) continue;
    if (lineDiscountPct(list, rate) > limit) return true;
  }
  return false;
}

export function computeLineAmount(qty: string, rate: string) {
  const q = Number(qty);
  const r = Number(rate);
  if (!Number.isFinite(q) || !Number.isFinite(r)) return "0";
  return (q * r).toFixed(2);
}

export function computeQuotationTotals(input: {
  lines: { amount: string }[];
  freightAmount: string;
  loadingCharges: string;
  gstPercent: string;
}) {
  const subtotal = input.lines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const freight = Number(input.freightAmount || 0);
  const loading = Number(input.loadingCharges || 0);
  const taxable = subtotal + freight + loading;
  const gstPct = Number(input.gstPercent || 0);
  const gstAmount = (taxable * gstPct) / 100;
  const total = taxable + gstAmount;
  return {
    subtotal: subtotal.toFixed(2),
    total: total.toFixed(2),
    taxBreakup: {
      gstPercent: gstPct,
      taxableAmount: taxable.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
    },
  };
}

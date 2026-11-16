"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { FormFeedback } from "@/components/form-feedback";
import { toast } from "@/components/toast";
import {
  computeLineAmount,
  computeQuotationTotals,
  lineDiscountPct,
  quotationNeedsDiscountApproval,
  quotationNeedsPricingApproval,
} from "@/modules/leads/quotations/pricing";
import { quotationMaxDiscountPct } from "@/modules/leads/quotations/config";
import { quotationLinePresentation } from "@/modules/leads/quotations/line-description";

type QuotationDetail = {
  id: string;
  status: string;
  validUntil: string;
  deliveryTimeDays: number | null;
  freightAmount: string;
  loadingCharges: string;
  gstPercent: string;
  notes: string | null;
  items: {
    id: string;
    leadItemId: string | null;
    productId: string | null;
    description: string | null;
    grade: string | null;
    size: string | null;
    product?: { name?: string | null; code?: string | null; grade?: string | null } | null;
    leadItem?: {
      itemDescription?: string | null;
      specifications?: unknown;
      sizeOrCapacity?: string | null;
      mfgGrade?: string | null;
      gaugeThicknessMm?: string | null;
      product?: { name?: string | null; code?: string | null; grade?: string | null } | null;
      parentProduct?: { name?: string | null; sku?: string | null } | null;
      productVariant?: { displayName?: string | null; sku?: string | null } | null;
      expectedDeliveryDate?: string | null;
    } | null;
    qty: string;
    uom: string;
    listRate: string | null;
    rate: string;
    pricingBasis: string | null;
    expectedDeliveryDate: string | null;
  }[];
};

type LineDraft = {
  key: string;
  leadItemId?: string;
  productId?: string;
  title: string;
  subtitle: string;
  grade: string;
  size: string;
  qty: string;
  uom: string;
  marketRate: string;
  offerRate: string;
  pricingBasis: "" | "PER_KG" | "PER_PIECE";
  expectedDeliveryDate: string;
};

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function linesFromDetail(items: QuotationDetail["items"]): LineDraft[] {
  return items.map((item) => {
    const presentation = quotationLinePresentation(item);
    return {
    key: item.id,
    leadItemId: item.leadItemId ?? undefined,
    productId: item.productId ?? undefined,
    title: presentation.title,
    subtitle: presentation.spec,
    grade: presentation.grade !== "—" ? presentation.grade : item.grade ?? "",
    size: presentation.size !== "—" ? presentation.size : item.size ?? "",
    qty: item.qty,
    uom: item.uom,
    marketRate: item.listRate ?? "",
    offerRate: item.rate,
    pricingBasis:
      item.pricingBasis === "PER_KG" || item.pricingBasis === "PER_PIECE"
        ? item.pricingBasis
        : "",
    expectedDeliveryDate: item.expectedDeliveryDate ?? item.leadItem?.expectedDeliveryDate ?? "",
  };
  });
}

export function QuotationDraftEditor({
  quotationId,
  canEdit,
  onSaved,
}: {
  quotationId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [validUntil, setValidUntil] = useState("");
  const [deliveryTimeDays, setDeliveryTimeDays] = useState("");
  const [freightAmount, setFreightAmount] = useState("0");
  const [loadingCharges, setLoadingCharges] = useState("0");
  const [gstPercent, setGstPercent] = useState("18");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/quotations/${quotationId}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not load quotation.");
        return;
      }
      const data = json.data as QuotationDetail;
      if (data.status !== "DRAFT") {
        setError("Only draft quotations can be edited here.");
        return;
      }
      setValidUntil(toDatetimeLocalValue(data.validUntil));
      setDeliveryTimeDays(data.deliveryTimeDays != null ? String(data.deliveryTimeDays) : "");
      setFreightAmount(data.freightAmount || "0");
      setLoadingCharges(data.loadingCharges || "0");
      setGstPercent(data.gstPercent || "18");
      setNotes(data.notes ?? "");
      setLines(linesFromDetail(data.items));
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const previewTotals = useMemo(() => {
    const amounts = lines.map((line) => ({
      amount: computeLineAmount(line.qty, line.offerRate),
    }));
    return computeQuotationTotals({
      lines: amounts,
      freightAmount: freightAmount || "0",
      loadingCharges: loadingCharges || "0",
      gstPercent: gstPercent || "0",
    });
  }, [lines, freightAmount, loadingCharges, gstPercent]);

  const needsPricingApproval = useMemo(
    () =>
      quotationNeedsPricingApproval(
        lines.map((line) => ({ listRate: line.marketRate || null, rate: line.offerRate || "0" })),
      ),
    [lines],
  );

  const deepDiscount = useMemo(
    () =>
      quotationNeedsDiscountApproval(
        lines.map((line) => ({ listRate: line.marketRate || null, rate: line.offerRate || "0" })),
      ),
    [lines],
  );

  const maxDiscount = quotationMaxDiscountPct();

  const gstAmount = useMemo(() => {
    const freight = Number(freightAmount || 0);
    const loading = Number(loadingCharges || 0);
    const sub = Number(previewTotals.subtotal);
    const taxable = sub + freight + loading;
    const pct = Number(gstPercent || 0);
    return ((taxable * pct) / 100).toFixed(2);
  }, [previewTotals.subtotal, freightAmount, loadingCharges, gstPercent]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    const qtyPattern = /^\d+(\.\d{1,3})?$/;
    const ratePattern = /^\d+(\.\d{1,3})?$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!qtyPattern.test(line.qty.trim())) {
        setError(`${line.title}: enter a valid quantity.`);
        setSaving(false);
        return;
      }
      if (!ratePattern.test(line.offerRate.trim())) {
        setError(`${line.title}: enter the offer rate you will send to the customer.`);
        setSaving(false);
        return;
      }
      if (line.marketRate.trim() && !ratePattern.test(line.marketRate.trim())) {
        setError(`${line.title}: market rate must be a valid number.`);
        setSaving(false);
        return;
      }
    }
    if (!lines.length) {
      setError("No line items on this quotation.");
      setSaving(false);
      return;
    }

    const payload = {
      validUntil: fromDatetimeLocalValue(validUntil),
      deliveryTimeDays: deliveryTimeDays.trim() ? Number(deliveryTimeDays) : undefined,
      freightAmount: freightAmount.trim() || "0",
      loadingCharges: loadingCharges.trim() || "0",
      gstPercent: gstPercent.trim() || "18",
      notes: notes.trim() || undefined,
      includesMtc: false,
      thirdPartyInspection: false,
      paymentTerms: undefined,
      deliveryTerms: undefined,
      items: lines.map((line) => ({
        leadItemId: line.leadItemId,
        productId: line.productId,
        description: line.title,
        grade: line.grade.trim() || undefined,
        size: line.size.trim() || undefined,
        qty: line.qty.trim(),
        uom: line.uom.trim() || "PCS",
        listRate: line.marketRate.trim() || undefined,
        rate: line.offerRate.trim(),
        pricingBasis: line.pricingBasis || undefined,
        expectedDeliveryDate: line.expectedDeliveryDate.trim() || undefined,
      })),
    };

    try {
      const response = await fetch(`/api/v1/quotations/${quotationId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKeyRef.current,
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const message = json?.error?.message ?? "Could not save quotation.";
        setError(message);
        toast.error(message);
        return;
      }
      idempotencyKeyRef.current = crypto.randomUUID();
      setSuccess("Prices saved on this lead and quotation.");
      toast.success("Prices saved on this lead and quotation.");
      await loadDetail();
      onSaved();
    } catch {
      setError("Could not reach the server.");
      toast.error("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading pricing…</p>;
  }

  if (error && !lines.length) {
    return <p className="text-sm text-danger">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Customer pricing (per product)</h3>
        <p className="mt-0.5 text-xs text-muted">
          Market rate is reference only; offer rate is what the customer sees on the quotation PDF.
        </p>
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => {
          const market = Number(line.marketRate || 0);
          const offer = Number(line.offerRate || 0);
          const disc = market > 0 && offer > 0 ? lineDiscountPct(market, offer) : 0;
          const belowMarket = market > 0 && offer > 0 && offer < market;
          const lineTotal = computeLineAmount(line.qty, line.offerRate || "0");
          const uomLabel = line.uom.trim() || "unit";
          return (
            <div key={line.key} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{line.title}</p>
                  {line.subtitle ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{line.subtitle}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm tabular-nums text-muted">
                  Line total{" "}
                  <span className="font-semibold text-foreground">₹{lineTotal}</span>
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label={`Market rate (₹/${uomLabel})`} detail="Reference only">
                  <input
                    className={controlClass}
                    inputMode="decimal"
                    placeholder="From product master"
                    value={line.marketRate}
                    disabled={!canEdit}
                    onChange={(e) => updateLine(index, { marketRate: e.target.value })}
                  />
                </Field>
                <Field label={`Offer to customer (₹/${uomLabel})`} detail="Required · shown on quotation">
                  <input
                    className={controlClass}
                    inputMode="decimal"
                    placeholder="Your quote"
                    value={line.offerRate}
                    disabled={!canEdit}
                    onChange={(e) => updateLine(index, { offerRate: e.target.value })}
                  />
                </Field>
                <Field label="Price basis">
                  <select
                    className={controlClass}
                    value={line.pricingBasis}
                    disabled={!canEdit}
                    onChange={(e) =>
                      updateLine(index, {
                        pricingBasis: e.target.value as LineDraft["pricingBasis"],
                      })
                    }
                  >
                    <option value="">Select basis</option>
                    <option value="PER_KG">Per kg</option>
                    <option value="PER_PIECE">Per piece</option>
                  </select>
                </Field>
                <Field label="Expected delivery" detail="From lead · adjust before send">
                  <input
                    type="date"
                    className={controlClass}
                    value={line.expectedDeliveryDate}
                    disabled={!canEdit}
                    onChange={(e) => updateLine(index, { expectedDeliveryDate: e.target.value })}
                  />
                </Field>
              </div>

              {belowMarket && disc > 0 ? (
                <div className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-100">
                  {disc > maxDiscount ? "⚠️" : "ℹ️"}{" "}
                  {disc.toFixed(1)}% below market.
                  {disc > maxDiscount
                    ? " Manager approval is needed before sending."
                    : " Shown on quotation after admin approves pricing."}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-4">
        <h4 className="text-sm font-semibold text-foreground">Terms &amp; validity</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Valid until">
            <input
              type="datetime-local"
              className={controlClass}
              value={validUntil}
              disabled={!canEdit}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </Field>
          <Field label="GST (%)">
            <input
              className={controlClass}
              value={gstPercent}
              disabled={!canEdit}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </Field>
          <Field label="Freight (₹)">
            <input
              className={controlClass}
              value={freightAmount}
              disabled={!canEdit}
              onChange={(e) => setFreightAmount(e.target.value)}
            />
          </Field>
          <Field label="Loading (₹)">
            <input
              className={controlClass}
              value={loadingCharges}
              disabled={!canEdit}
              onChange={(e) => setLoadingCharges(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Notes" detail="Optional terms or remarks for the customer">
            <textarea
              className={`${controlClass} min-h-20 py-2`}
              placeholder="Add terms or remarks for the customer"
              value={notes}
              disabled={!canEdit}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/25 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums text-muted">
          <span>
            Subtotal <strong className="font-semibold text-foreground">₹{previewTotals.subtotal}</strong>
          </span>
          <span>
            GST {gstPercent || "0"}%{" "}
            <strong className="font-semibold text-foreground">₹{gstAmount}</strong>
          </span>
          <span>
            Quotation total{" "}
            <strong className="font-semibold text-foreground">₹{previewTotals.total}</strong>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(needsPricingApproval || deepDiscount) && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
              {needsPricingApproval ? "Admin approval required" : ""}
              {needsPricingApproval && deepDiscount ? " · " : ""}
              {deepDiscount ? `discount over ${quotationMaxDiscountPct()}%` : ""}
            </span>
          )}
          {canEdit ? (
            <Button pending={saving} onClick={() => void saveDraft()}>
              Save prices on lead
            </Button>
          ) : null}
        </div>
      </div>

      <FormFeedback error={error} success={success} />
    </div>
  );
}

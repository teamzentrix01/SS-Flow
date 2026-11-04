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
} from "@/modules/leads/quotations/pricing";
import { quotationMaxDiscountPct } from "@/modules/leads/quotations/config";
import { quotationLinePresentation } from "@/modules/leads/quotations/line-description";

type QuotationDetail = {
  id: string;
  status: string;
  validUntil: string;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  deliveryTimeDays: number | null;
  freightAmount: string;
  loadingCharges: string;
  gstPercent: string;
  notes: string | null;
  includesMtc: boolean;
  thirdPartyInspection: boolean;
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
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTerms, setDeliveryTerms] = useState("");
  const [deliveryTimeDays, setDeliveryTimeDays] = useState("");
  const [freightAmount, setFreightAmount] = useState("0");
  const [loadingCharges, setLoadingCharges] = useState("0");
  const [gstPercent, setGstPercent] = useState("18");
  const [notes, setNotes] = useState("");
  const [includesMtc, setIncludesMtc] = useState(false);
  const [thirdPartyInspection, setThirdPartyInspection] = useState(false);
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
      setPaymentTerms(data.paymentTerms ?? "");
      setDeliveryTerms(data.deliveryTerms ?? "");
      setDeliveryTimeDays(data.deliveryTimeDays != null ? String(data.deliveryTimeDays) : "");
      setFreightAmount(data.freightAmount || "0");
      setLoadingCharges(data.loadingCharges || "0");
      setGstPercent(data.gstPercent || "18");
      setNotes(data.notes ?? "");
      setIncludesMtc(data.includesMtc);
      setThirdPartyInspection(data.thirdPartyInspection);
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

  const needsApproval = useMemo(
    () =>
      quotationNeedsDiscountApproval(
        lines.map((line) => ({ listRate: line.marketRate || null, rate: line.offerRate || "0" })),
      ),
    [lines],
  );

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
      paymentTerms: paymentTerms.trim() || undefined,
      deliveryTerms: deliveryTerms.trim() || undefined,
      deliveryTimeDays: deliveryTimeDays.trim() ? Number(deliveryTimeDays) : undefined,
      freightAmount: freightAmount.trim() || "0",
      loadingCharges: loadingCharges.trim() || "0",
      gstPercent: gstPercent.trim() || "18",
      notes: notes.trim() || undefined,
      includesMtc,
      thirdPartyInspection,
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

  const maxDiscount = quotationMaxDiscountPct();

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold">Customer pricing (per product)</h3>
        <p className="text-xs text-muted">
          Lines come from this lead&apos;s requested items. Market rate is your reference; offer rate is what
          the customer sees on the quotation. Saving updates this lead&apos;s CRM record.
        </p>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const market = Number(line.marketRate || 0);
          const offer = Number(line.offerRate || 0);
          const disc = market > 0 && offer > 0 ? lineDiscountPct(market, offer) : 0;
          const lineTotal = computeLineAmount(line.qty, line.offerRate || "0");
          return (
            <div key={line.key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{line.title}</p>
                  {line.subtitle ? <p className="text-xs text-muted">{line.subtitle}</p> : null}
                  <p className="mt-1 text-xs text-muted">
                    Qty {line.qty} {line.uom}
                  </p>
                </div>
                <p className="text-sm tabular-nums">
                  Line total <span className="font-semibold">₹{lineTotal}</span>
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label={`Market rate (₹ / ${line.uom})`} detail="Reference / list">
                  <input
                    className={controlClass}
                    inputMode="decimal"
                    placeholder="From product master"
                    value={line.marketRate}
                    disabled={!canEdit}
                    onChange={(e) => updateLine(index, { marketRate: e.target.value })}
                  />
                </Field>
                <Field label={`Offer to customer (₹ / ${line.uom})`} detail="Required">
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
                    <option value="">—</option>
                    <option value="PER_KG">Per kg</option>
                    <option value="PER_PIECE">Per piece</option>
                  </select>
                </Field>
              </div>
              <div className="mt-3 max-w-xs">
                <Field
                  label="Expected delivery (this product)"
                  detail="From lead or adjust before send"
                >
                  <input
                    type="date"
                    className={controlClass}
                    value={line.expectedDeliveryDate}
                    disabled={!canEdit}
                    onChange={(e) => updateLine(index, { expectedDeliveryDate: e.target.value })}
                  />
                </Field>
              </div>
              {market > 0 && offer > 0 && disc > maxDiscount ? (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
                  Discount {disc.toFixed(1)}% vs market — manager approval needed before send.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <details className="rounded-lg border border-border/80 bg-muted/10 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Terms & validity (optional)</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Valid until">
            <input
              type="datetime-local"
              className={controlClass}
              value={validUntil}
              disabled={!canEdit}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </Field>
          <Field label="GST %">
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
          <Field label="Payment terms">
            <input className={controlClass} value={paymentTerms} disabled={!canEdit} onChange={(e) => setPaymentTerms(e.target.value)} />
          </Field>
          <Field label="Delivery terms">
            <input className={controlClass} value={deliveryTerms} disabled={!canEdit} onChange={(e) => setDeliveryTerms(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className={`${controlClass} min-h-16 py-2`} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includesMtc} disabled={!canEdit} onChange={(e) => setIncludesMtc(e.target.checked)} />
          MTC included
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={thirdPartyInspection} disabled={!canEdit} onChange={(e) => setThirdPartyInspection(e.target.checked)} />
          Third-party inspection
        </label>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/20 px-3 py-2">
        <p className="text-sm text-muted">
          Quotation total{" "}
          <span className="font-semibold text-foreground">₹{previewTotals.total}</span>
          {needsApproval ? (
            <span className="ml-2 text-xs text-amber-800 dark:text-amber-200">· approval required</span>
          ) : null}
        </p>
        {canEdit ? (
          <Button pending={saving} onClick={() => void saveDraft()}>
            Save prices on lead
          </Button>
        ) : null}
      </div>

      <FormFeedback error={error} success={success} />
    </div>
  );
}

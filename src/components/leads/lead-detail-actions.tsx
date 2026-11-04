"use client";

import { useEffect, useState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { useConfirmModal } from "@/components/confirmation-modal";
import { statusRequiresNextFollowUp } from "@/modules/leads/follow-up";
import { isCustomLeadOrder, leadOrderTypeLabel } from "@/modules/leads/order-type";
import {
  leadRequiresLostReason,
  leadStatusDescription,
  leadStatusLabel,
  manualLeadStatusOptions,
  type LeadStatus,
} from "@/modules/leads/status";
import { lostReasonOptions } from "@/modules/leads/lost-reason";

const VERIFY_CHECKS = [
  {
    key: "customerConfirmed",
    label: "Customer & contact confirmed",
    detail: "Company, contact person, phone and email match the enquiry",
  },
  {
    key: "itemsConfirmed",
    label: "Material & specifications confirmed",
    detail: "Grade, finish, thickness and dimensions agreed with the customer",
  },
  {
    key: "quantityConfirmed",
    label: "Quantity & UOM confirmed",
    detail: "Order quantity and unit of measure are commercially workable",
  },
  {
    key: "genuineRequirementConfirmed",
    label: "Genuine buying requirement",
    detail: "Need is real and actionable — not a price check or incomplete query",
  },
] as const;

export function LeadDetailActions({
  leadId,
  status,
  orderType = "READY_STOCK",
  productStock,
  showFulfillmentPreview = false,
  canVerify,
  canConvert,
  canManage,
  customer,
  items,
  products,
  promisedDate,
  requiredDeliveryDate,
  promisedDeliveryDate,
  competitorName: initialCompetitorName = "",
  competitorRate: initialCompetitorRate = "",
  customerTargetRate: initialCustomerTargetRate = "",
}: {
  leadId: string;
  status: string;
  orderType?: string;
  productStock?: Record<string, number>;
  showFulfillmentPreview?: boolean;
  canVerify: boolean;
  canConvert: boolean;
  canManage: boolean;
  customer: { name: string; contact: string; phone: string; email: string | null; address: string | null; linked: string | null };
  items: { id: string; productId: string | null; productName: string; quantity: string; uom: string; targetPrice: string; configuredPrice: string; specifications: Record<string, unknown> }[];
  products: { id: string; name: string; uom: string; categoryId: string; minOrderQty?: string | null }[];
  promisedDate?: string;
  requiredDeliveryDate?: string;
  promisedDeliveryDate?: string;
  competitorName?: string;
  competitorRate?: string;
  customerTargetRate?: string;
}) {
  const verifyPost = usePost();
  const rejectPost = usePost();
  const statusPost = usePost();
  const negotiationPost = usePost();
  const convertPost = usePost();
  const datesPost = usePost();
  const { confirm, ConfirmDialog } = useConfirmModal();
  const [checks, setChecks] = useState({
    customerConfirmed: false,
    itemsConfirmed: false,
    quantityConfirmed: false,
    genuineRequirementConfirmed: false,
  });
  const [verifyNotes, setVerifyNotes] = useState("");
  const availableStatuses = manualLeadStatusOptions(status, orderType);
  const [newStatus, setNewStatus] = useState<string>(availableStatuses[0] ?? "CONTACTED");
  const [statusReason, setStatusReason] = useState("");
  const [lostReasonCode, setLostReasonCode] = useState("");
  const [rejectionCode, setRejectionCode] = useState("");
  const [competitorName, setCompetitorName] = useState(initialCompetitorName);
  const [competitorRate, setCompetitorRate] = useState(initialCompetitorRate);
  const [customerTargetRate, setCustomerTargetRate] = useState(initialCustomerTargetRate);
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [productSelections, setProductSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items
        .filter((item) => item.productId && products.some((product) => product.id === item.productId))
        .map((item) => [item.id, item.productId!]),
    ),
  );
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.targetPrice || item.configuredPrice || ""])),
  );
  const initialRequired = requiredDeliveryDate ?? (promisedDate || "");
  const initialPromised = promisedDeliveryDate ?? "";
  const [editRequiredDate, setEditRequiredDate] = useState(initialRequired);
  const [editPromisedDate, setEditPromisedDate] = useState(initialPromised);
  const [confirmPromisedDate, setConfirmPromisedDate] = useState(initialPromised);
  const [expectedDispatchDate, setExpectedDispatchDate] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poAttachmentUrl, setPoAttachmentUrl] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [lineFulfillment, setLineFulfillment] = useState<
    Record<string, { inStock?: boolean; estimatedLeadTimeDays?: string }>
  >({});
  const [quotationOptions, setQuotationOptions] = useState<
    { id: string; quotationNumber: string; version: number; status: string }[]
  >([]);
  const [acceptedQuotationId, setAcceptedQuotationId] = useState("");
  const stockByProduct = productStock ?? {};
  const isPromisedLateInReview = Boolean(
    initialRequired && confirmPromisedDate && confirmPromisedDate > initialRequired,
  );
  const allChecks = Object.values(checks).every(Boolean);
  const selectedStatus = (availableStatuses.includes(newStatus as LeadStatus)
    ? newStatus
    : availableStatuses[0] ?? "") as LeadStatus | "";
  const reasonRequired = selectedStatus ? leadRequiresLostReason(selectedStatus) : false;
  const lostOutcome = selectedStatus === "LOST" || selectedStatus === "REJECTED" ? selectedStatus : null;
  const stageReasonReady =
    !reasonRequired ||
    (Boolean(lostReasonCode) && (lostReasonCode !== "OTHER" || statusReason.trim().length > 0));
  const followUpRequired = selectedStatus ? statusRequiresNextFollowUp(selectedStatus) : false;
  const legacyVerificationStage = status === "VERIFICATION_PENDING";
  const preQualified = ["NEW", "CONTACTED", "FOLLOW_UP", "ON_HOLD", "VERIFICATION_PENDING"].includes(status);
  const customOrder = isCustomLeadOrder(orderType);
  const customPoWarning =
    customOrder && reviewOpen && !poNumber.trim() && !advanceAmount.trim();

  useEffect(() => {
    if (!reviewOpen) return;
    void (async () => {
      const res = await fetch(`/api/v1/leads/${leadId}/quotations`);
      const json = await res.json().catch(() => null);
      const list = (json?.data ?? []) as typeof quotationOptions;
      const eligible = list.filter((row) => row.status === "SENT" || row.status === "ACCEPTED");
      setQuotationOptions(eligible);
      if (eligible.length === 1) setAcceptedQuotationId(eligible[0].id);
    })();
  }, [reviewOpen, leadId]);

  useEffect(() => {
    if (!acceptedQuotationId) return;
    void (async () => {
      const res = await fetch(`/api/v1/quotations/${acceptedQuotationId}`);
      const json = await res.json().catch(() => null);
      const quote = json?.data;
      if (!quote?.items) return;
      const nextPrices: Record<string, string> = {};
      const nextProducts: Record<string, string> = {};
      for (const line of quote.items as { leadItemId: string | null; rate: string; productId: string | null }[]) {
        if (line.leadItemId && line.rate) nextPrices[line.leadItemId] = line.rate;
        if (line.leadItemId && line.productId) nextProducts[line.leadItemId] = line.productId;
      }
      setPrices((current) => ({ ...current, ...nextPrices }));
      setProductSelections((current) => ({ ...current, ...nextProducts }));
    })();
  }, [acceptedQuotationId]);

  return (
    <div className="grid gap-4">
      {/* Step 1 — advance the lead through the commercial pipeline */}
      {canManage && status !== "CONVERTED" && availableStatuses.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Step 1</p>
              <h2 className="font-semibold">Update lead stage</h2>
              <p className="mt-0.5 text-sm text-muted">
                Advance the commercial pipeline (contact → quote → negotiation). Current stage:{" "}
                <span className="font-medium text-foreground">{leadStatusLabel(status)}</span>
                {leadStatusDescription(status) ? ` — ${leadStatusDescription(status)}` : ""}.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
            <Field label="Next stage">
              <select
                className={controlClass}
                value={selectedStatus}
                onChange={(event) => setNewStatus(event.target.value)}
              >
                {availableStatuses.map((value) => (
                  <option key={value} value={value}>
                    {leadStatusLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={followUpRequired ? "Next follow-up (required)" : "Next follow-up"}
              detail={followUpRequired ? "Required for this stage" : undefined}
            >
              <input
                type="datetime-local"
                className={controlClass}
                value={nextFollowUpAt}
                onChange={(event) => setNextFollowUpAt(event.target.value)}
              />
            </Field>
            {lostOutcome ? (
              <>
                <Field label="Structured reason (required)">
                  <select
                    className={controlClass}
                    value={lostReasonCode}
                    onChange={(event) => setLostReasonCode(event.target.value)}
                  >
                    <option value="">Select reason</option>
                    {lostReasonOptions(lostOutcome).map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={lostReasonCode === "OTHER" ? "Details (required)" : "Additional note"}
                  detail="Stored in activity history"
                >
                  <input
                    className={controlClass}
                    value={statusReason}
                    onChange={(event) => setStatusReason(event.target.value)}
                    placeholder={
                      lostReasonCode === "OTHER" ? "Describe why" : "Optional context"
                    }
                  />
                </Field>
                {lostOutcome === "LOST" ? (
                  <>
                    <Field label="Competitor name" detail="optional">
                      <input
                        className={controlClass}
                        value={competitorName}
                        onChange={(event) => setCompetitorName(event.target.value)}
                      />
                    </Field>
                    <Field label="Competitor rate" detail="optional">
                      <input
                        className={controlClass}
                        inputMode="decimal"
                        value={competitorRate}
                        onChange={(event) => setCompetitorRate(event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : (
              <Field label="Note (optional)" detail={selectedStatus ? leadStatusDescription(selectedStatus) : undefined}>
                <input
                  className={controlClass}
                  value={statusReason}
                  onChange={(event) => setStatusReason(event.target.value)}
                  placeholder="Optional note for the activity history"
                />
              </Field>
            )}
            {selectedStatus === "NEGOTIATION" ? (
              <Field label="Customer target rate" detail="optional">
                <input
                  className={controlClass}
                  inputMode="decimal"
                  value={customerTargetRate}
                  onChange={(event) => setCustomerTargetRate(event.target.value)}
                />
              </Field>
            ) : null}
            <Button
              pending={statusPost.pending}
              disabled={
                !stageReasonReady ||
                (followUpRequired && !nextFollowUpAt.trim())
              }
              onClick={() =>
                void statusPost.post(
                  `/api/v1/leads/${leadId}/status`,
                  {
                    status: selectedStatus,
                    lostReasonCode: lostReasonCode || undefined,
                    lostReasonNote: statusReason || undefined,
                    competitorName: competitorName || undefined,
                    competitorRate: competitorRate || undefined,
                    customerTargetRate:
                      selectedStatus === "NEGOTIATION" ? customerTargetRate || undefined : undefined,
                    nextFollowUpAt: nextFollowUpAt || undefined,
                  },
                  { successMessage: "Lead stage updated." },
                )
              }
            >
              Save stage
            </Button>
          </div>
          <FormFeedback error={statusPost.error} success={statusPost.success} />
          {preQualified && canVerify ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
              When contact, specs and quantity are confirmed, complete <strong>Step 2 — Verify requirement</strong>{" "}
              to mark the lead as <strong>Qualified</strong> (no separate verification stage needed).
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Step 2 — verification checklist (after stage progress) */}
      {canVerify ? (
        <section
          className={`space-y-3 rounded-xl border p-4 ${
            legacyVerificationStage
              ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
              : "border-amber-300 bg-card"
          }`}
        >
          <div className="flex items-start gap-2">
            <input
              id={`verify-all-${leadId}`}
              type="checkbox"
              checked={allChecks}
              onChange={(event) => {
                const checked = event.target.checked;
                setChecks({
                  customerConfirmed: checked,
                  itemsConfirmed: checked,
                  quantityConfirmed: checked,
                  genuineRequirementConfirmed: checked,
                });
              }}
              aria-label="Select all verification checks"
              className="mt-1 size-4 accent-[var(--success)]"
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Step 2</p>
              <h2 className="font-semibold">
                <label htmlFor={`verify-all-${leadId}`} className="cursor-pointer">
                  Verify requirement
                </label>
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                Confirm each check once the enquiry is understood. This marks the lead{" "}
                <strong>Qualified</strong>. Use the <strong>Quotations</strong> section above to enter market
                and offer rates per product before you send the quote to the customer.
              </p>
            </div>
          </div>
          <div className="grid gap-2.5 text-sm">
            {VERIFY_CHECKS.map(({ key, label, detail }) => (
              <label
                key={key}
                className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/60 px-3 py-2"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--success)]"
                  checked={checks[key]}
                  onChange={(event) =>
                    setChecks((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{detail}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label="Verification notes (optional)">
            <textarea
              className={`${controlClass} min-h-20`}
              value={verifyNotes}
              onChange={(event) => setVerifyNotes(event.target.value)}
              placeholder="Any clarification agreed with the customer"
            />
          </Field>
          <FormFeedback error={verifyPost.error} success={verifyPost.success} />
          <Button
            pending={verifyPost.pending}
            disabled={!allChecks}
            onClick={() =>
              void verifyPost.post(
                `/api/v1/leads/${leadId}/verify`,
                { checks, verificationNotes: verifyNotes || undefined },
                { successMessage: "Lead marked as qualified." },
              )
            }
          >
            Mark as qualified
          </Button>
        </section>
      ) : null}

      {canManage && ["NEGOTIATION", "QUOTATION_SENT"].includes(status) ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Negotiation intelligence</h2>
          <p className="text-sm text-muted">Optional competitor and target pricing while the deal is active.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Competitor name">
              <input
                className={controlClass}
                value={competitorName}
                onChange={(event) => setCompetitorName(event.target.value)}
              />
            </Field>
            <Field label="Competitor rate">
              <input
                className={controlClass}
                inputMode="decimal"
                value={competitorRate}
                onChange={(event) => setCompetitorRate(event.target.value)}
              />
            </Field>
            <Field label="Customer target rate">
              <input
                className={controlClass}
                inputMode="decimal"
                value={customerTargetRate}
                onChange={(event) => setCustomerTargetRate(event.target.value)}
              />
            </Field>
          </div>
          <FormFeedback error={negotiationPost.error} success={negotiationPost.success} />
          <Button
            pending={negotiationPost.pending}
            onClick={() =>
              void negotiationPost.post(
                `/api/v1/leads/${leadId}/negotiation`,
                {
                  competitorName,
                  competitorRate,
                  customerTargetRate,
                },
                { successMessage: "Negotiation details saved." },
              )
            }
          >
            Save intelligence
          </Button>
        </section>
      ) : null}

      {canManage && !["CONVERTED", "REJECTED", "LOST"].includes(status) ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Reject enquiry</h2>
          <p className="text-sm text-muted">
            Use this when the enquiry is invalid or cannot be fulfilled. Prefer{" "}
            <strong>Lost</strong> in Step 1 when the customer simply chose not to proceed.
          </p>
          <Field label="Structured reason (required)">
            <select
              className={controlClass}
              value={rejectionCode}
              onChange={(event) => setRejectionCode(event.target.value)}
            >
              <option value="">Select reason</option>
              {lostReasonOptions("REJECTED").map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={rejectionCode === "OTHER" ? "Details (required)" : "Additional note"}>
            <textarea
              className={`${controlClass} min-h-20`}
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
            />
          </Field>
          <FormFeedback error={rejectPost.error} success={rejectPost.success} />
          <Button
            tone="danger"
            pending={rejectPost.pending}
            disabled={
              !rejectionCode || (rejectionCode === "OTHER" && !statusReason.trim())
            }
            onClick={() => {
              confirm({
                title: "Reject lead?",
                message: "You're about to mark this lead as rejected.",
                consequence: (
                  <>
                    <strong className="font-semibold text-slate-800 dark:text-slate-100">
                      Status updated to Rejected.
                    </strong>{" "}
                    The reason will be permanently saved in the lead activity history.
                  </>
                ),
                confirmText: "Reject lead",
                cancelText: "Cancel",
                tone: "danger",
                onConfirm: () =>
                  rejectPost.post(
                    `/api/v1/leads/${leadId}/status`,
                    {
                      status: "REJECTED",
                      lostReasonCode: rejectionCode,
                      lostReasonNote: statusReason || undefined,
                    },
                    { successMessage: "Lead rejected." },
                  ),
              });
            }}
          >
            Reject Lead
          </Button>
        </section>
      ) : null}

      {canManage && status !== "CONVERTED" ? (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer font-semibold">Update delivery dates</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3 sm:items-end">
            <Field label="Required delivery date" detail="Customer requested date">
              <input
                className={controlClass}
                type="date"
                value={editRequiredDate}
                onChange={(e) => setEditRequiredDate(e.target.value)}
              />
            </Field>
            <Field label="Promised delivery date" detail="SS-Metals commitment">
              <input
                className={controlClass}
                type="date"
                value={editPromisedDate}
                onChange={(e) => setEditPromisedDate(e.target.value)}
              />
            </Field>
            <div>
              <Button
                pending={datesPost.pending}
                onClick={() =>
                  void datesPost.post(
                    `/api/v1/leads/${leadId}/dates`,
                    {
                      requiredDeliveryDate: editRequiredDate || null,
                      promisedDeliveryDate: editPromisedDate || null,
                    },
                    { successMessage: "Delivery dates updated." },
                  )
                }
              >
                Save delivery dates
              </Button>
            </div>
          </div>
          {editRequiredDate && editPromisedDate && editPromisedDate > editRequiredDate ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Notice: Promised delivery date ({editPromisedDate}) is later than customer&apos;s
              required delivery date ({editRequiredDate}).
            </p>
          ) : null}
          <FormFeedback error={datesPost.error} success={datesPost.success} />
        </details>
      ) : null}

      {showFulfillmentPreview && !canConvert && products.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <h2 className="font-semibold">Stock & MOQ (quotation)</h2>
            <p className="text-sm text-muted">
              Indicative availability before conversion. Map each line to a stock SKU when creating the sales order.
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {items.map((item) => {
              const productId =
                productSelections[item.id] ??
                (item.productId && products.some((p) => p.id === item.productId)
                  ? item.productId
                  : "");
              const product = productId ? products.find((p) => p.id === productId) : undefined;
              const qty = Number(item.quantity) || 0;
              const available = productId ? (stockByProduct[productId] ?? 0) : 0;
              const moq = product?.minOrderQty ? Number(product.minOrderQty) : null;
              const belowMoq = moq != null && qty > 0 && qty < moq;
              const inStockHint = productId && qty > 0 ? available >= qty : null;
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-border/70 bg-background/60 px-3 py-2"
                >
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted">
                    {item.quantity} {item.uom}
                    {product ? ` · ${product.name}` : " · No stock SKU linked yet"}
                  </p>
                  {productId ? (
                    <p className="mt-1 text-xs">
                      Available {available} {product?.uom ?? item.uom} ·{" "}
                      {inStockHint === true ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Likely in stock</span>
                      ) : inStockHint === false ? (
                        <span className="text-amber-700 dark:text-amber-300">Likely must produce / backorder</span>
                      ) : null}
                      {belowMoq ? (
                        <span className="ml-2 text-amber-700 dark:text-amber-300">
                          Below MOQ ({moq} {product?.uom})
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {canConvert ? (
        <section className="space-y-3 rounded-xl border border-emerald-300 bg-card p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Step 3</p>
            <h2 className="font-semibold">Create Sales Order</h2>
            <p className="text-sm text-muted">
              Review stock vs production, PO details, and every line before confirming ({leadOrderTypeLabel(orderType)}).
            </p>
          </div>
          <Button onClick={() => setReviewOpen(true)}>Create Sales Order</Button>
          {reviewOpen ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" aria-label="Review sales order">
              <h3 className="font-semibold">Review Sales Order</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Customer</dt>
                  <dd>{customer.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">Contact</dt>
                  <dd>
                    {customer.contact} · {customer.phone}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Email</dt>
                  <dd>{customer.email || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Address</dt>
                  <dd>{customer.address || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Customer record</dt>
                  <dd>{customer.linked || "Will reuse a matching customer or create one"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Required delivery (customer)</dt>
                  <dd>{initialRequired || "Not specified"}</dd>
                </div>
              </dl>
              <div className="rounded-md border border-border bg-card p-3 space-y-2">
                <Field
                  label="Confirmed promised delivery date (SS-Metals commitment)"
                  detail="Leave empty if not yet confirmed; will not overwrite required date"
                >
                  <input
                    type="date"
                    className={controlClass}
                    value={confirmPromisedDate}
                    onChange={(e) => setConfirmPromisedDate(e.target.value)}
                  />
                </Field>
                {isPromisedLateInReview ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Notice: Confirmed promised date ({confirmPromisedDate}) is later than
                    customer&apos;s required date ({initialRequired}).
                  </p>
                ) : null}
              </div>
              {quotationOptions.length ? (
                <Field label="Accepted quotation" detail="Pre-fills rates from sent quote">
                  <select
                    className={controlClass}
                    value={acceptedQuotationId}
                    onChange={(e) => setAcceptedQuotationId(e.target.value)}
                  >
                    <option value="">None</option>
                    {quotationOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.quotationNumber} v{row.version} ({row.status})
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <Field label="Customer PO number">
                  <input className={controlClass} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
                </Field>
                <Field label="PO attachment URL">
                  <input
                    className={controlClass}
                    value={poAttachmentUrl}
                    onChange={(e) => setPoAttachmentUrl(e.target.value)}
                    placeholder="Link to uploaded PO file"
                  />
                </Field>
                <Field label="Advance amount (₹)">
                  <input
                    className={controlClass}
                    inputMode="decimal"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                </Field>
                <Field label="Expected dispatch date">
                  <input
                    type="date"
                    className={controlClass}
                    value={expectedDispatchDate}
                    onChange={(e) => setExpectedDispatchDate(e.target.value)}
                  />
                </Field>
              </div>
              {customPoWarning ? (
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  Custom order: PO number or advance amount is not recorded yet (you can still convert).
                </p>
              ) : null}
              <div className="space-y-3">
                {items.map((item) => {
                  const selectedProductId = productSelections[item.id] || "";
                  const available = selectedProductId ? stockByProduct[selectedProductId] ?? 0 : 0;
                  const qty = Number(item.quantity);
                  const product = products.find((row) => row.id === selectedProductId);
                  const moq = product?.minOrderQty ? Number(product.minOrderQty) : null;
                  const suggestedInStock = selectedProductId && available >= qty;
                  const fulfillment = lineFulfillment[item.id] ?? {};
                  const inStock =
                    fulfillment.inStock ?? (suggestedInStock ? true : available > 0 ? false : undefined);
                  return (
                    <div key={item.id} className="grid gap-2 rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted">
                            {item.quantity} {item.uom}
                            {selectedProductId
                              ? ` · Stock ${available.toLocaleString("en-IN")} ${item.uom}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            inStock === true
                              ? "bg-success-soft text-success"
                              : inStock === false
                                ? "bg-warning-soft text-warning"
                                : "bg-neutral-soft text-neutral"
                          }`}
                        >
                          {inStock === true ? "In stock" : inStock === false ? "Must produce" : "Select product"}
                        </span>
                      </div>
                      {moq != null && qty < moq ? (
                        <p className="text-xs text-amber-700">Below MOQ ({moq})</p>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
                        <Field label="Sales product">
                          <select
                            className={controlClass}
                            value={selectedProductId}
                            onChange={(event) => {
                              const value = event.target.value;
                              setProductSelections((current) => ({ ...current, [item.id]: value }));
                              const avail = value ? stockByProduct[value] ?? 0 : 0;
                              setLineFulfillment((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  inStock: value ? avail >= qty : undefined,
                                },
                              }));
                            }}
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Unit price (optional)">
                          <input
                            className={controlClass}
                            inputMode="decimal"
                            value={prices[item.id] || ""}
                            placeholder="ERP default: 0"
                            onChange={(event) =>
                              setPrices((current) => ({ ...current, [item.id]: event.target.value }))
                            }
                          />
                        </Field>
                        <Field label="Fulfillment">
                          <select
                            className={controlClass}
                            value={inStock === true ? "stock" : inStock === false ? "produce" : ""}
                            onChange={(event) =>
                              setLineFulfillment((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  inStock: event.target.value === "stock",
                                },
                              }))
                            }
                          >
                            <option value="">Auto</option>
                            <option value="stock">In stock</option>
                            <option value="produce">Must produce</option>
                          </select>
                        </Field>
                        <Field label="Est. lead time (days)" detail="If must produce">
                          <input
                            className={controlClass}
                            inputMode="numeric"
                            value={fulfillment.estimatedLeadTimeDays ?? ""}
                            onChange={(event) =>
                              setLineFulfillment((current) => ({
                                ...current,
                                [item.id]: {
                                  ...current[item.id],
                                  estimatedLeadTimeDays: event.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  );
                })}
              </div>
              <FormFeedback error={convertPost.error} success={convertPost.success} />
              <div className="flex flex-wrap gap-2">
                <Button
                  pending={convertPost.pending}
                  disabled={items.some((item) => !productSelections[item.id])}
                  onClick={() =>
                    void convertPost.post(
                      `/api/v1/leads/${leadId}/convert`,
                      {
                        promisedDate: confirmPromisedDate || undefined,
                        expectedDispatchDate: expectedDispatchDate || undefined,
                        poNumber: poNumber || undefined,
                        poAttachmentUrl: poAttachmentUrl || undefined,
                        advanceAmount: advanceAmount || undefined,
                        quotationId: acceptedQuotationId || undefined,
                        lines: items.map((item) => ({
                          leadItemId: item.id,
                          productId: productSelections[item.id],
                          unitPrice: prices[item.id] || undefined,
                          inStock: lineFulfillment[item.id]?.inStock,
                          estimatedLeadTimeDays: lineFulfillment[item.id]?.estimatedLeadTimeDays
                            ? Number(lineFulfillment[item.id]?.estimatedLeadTimeDays)
                            : undefined,
                        })),
                      },
                      { successMessage: "Sales Order created." },
                    )
                  }
                >
                  Confirm and Create Sales Order
                </Button>
                <Button tone="ghost" disabled={convertPost.pending} onClick={() => setReviewOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      {ConfirmDialog}
    </div>
  );
}

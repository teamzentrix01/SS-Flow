"use client";

import { useState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass, TextLink } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { useConfirmModal } from "@/components/confirmation-modal";
import { canTransitionLead, LEAD_STATUSES, type LeadStatus } from "@/modules/leads/status";

export function LeadDetailActions({
  leadId,
  status,
  canVerify,
  canConvert,
  canManage,
  customer,
  items,
  products,
  promisedDate,
  salesOrder,
}: {
  leadId: string;
  status: string;
  canVerify: boolean;
  canConvert: boolean;
  canManage: boolean;
  customer: { name: string; contact: string; phone: string; email: string | null; address: string | null; linked: string | null };
  items: { id: string; productId: string | null; productName: string; quantity: string; uom: string; targetPrice: string; configuredPrice: string; specifications: Record<string, unknown> }[];
  products: { id: string; name: string; uom: string; categoryId: string }[];
  promisedDate: string;
  salesOrder: { id: string; number: string } | null;
}) {
  const verifyPost = usePost();
  const rejectPost = usePost();
  const statusPost = usePost();
  const convertPost = usePost();
  const { confirm, ConfirmDialog } = useConfirmModal();
  const [checks, setChecks] = useState({ customerConfirmed: false, itemsConfirmed: false, quantityConfirmed: false, genuineRequirementConfirmed: false });
  const [verifyNotes, setVerifyNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [newStatus, setNewStatus] = useState("CONTACTED");
  const [statusReason, setStatusReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [productSelections, setProductSelections] = useState<Record<string, string>>(() => Object.fromEntries(items.filter((item) => item.productId && products.some((product) => product.id === item.productId)).map((item) => [item.id, item.productId!] )));
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.id, item.targetPrice || item.configuredPrice || ""])));
  const allChecks = Object.values(checks).every(Boolean);
  const availableStatuses = LEAD_STATUSES.filter((value) => value !== "VERIFIED" && value !== "CONVERTED" && canTransitionLead(status, value));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canVerify ? (
        <section className="space-y-3 rounded-xl border border-amber-300 bg-card p-4">
          <h2 className="font-semibold">Verify lead</h2>
          <div className="grid gap-2 text-sm">
            {([
              ["customerConfirmed", "Customer and contact information confirmed"],
              ["itemsConfirmed", "Material and applicable specifications confirmed"],
              ["quantityConfirmed", "Quantity and unit of measure confirmed"],
              ["genuineRequirementConfirmed", "Genuine customer requirement confirmed"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2"><input type="checkbox" checked={checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} /><span>{label}</span></label>
            ))}
          </div>
          <Field label="Verification notes (optional)"><textarea className={`${controlClass} min-h-20`} value={verifyNotes} onChange={(event) => setVerifyNotes(event.target.value)} /></Field>
          <FormFeedback error={verifyPost.error} success={verifyPost.success} />
          <Button pending={verifyPost.pending} disabled={!allChecks} onClick={() => void verifyPost.post(`/api/v1/leads/${leadId}/verify`, { checks, verificationNotes: verifyNotes || undefined }, { successMessage: "Lead verified." })}>Verify Lead</Button>
        </section>
      ) : null}

      {canManage && !["CONVERTED", "REJECTED", "LOST"].includes(status) ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Reject lead</h2>
          <Field label="Reason (required)"><textarea className={`${controlClass} min-h-20`} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></Field>
          <FormFeedback error={rejectPost.error} success={rejectPost.success} />
          <Button
            tone="danger"
            pending={rejectPost.pending}
            disabled={!rejectionReason.trim()}
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
                    { status: "REJECTED", reason: rejectionReason },
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
        <details className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <summary className="cursor-pointer font-semibold">Other status actions</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <Field label="Status"><select className={controlClass} value={availableStatuses.includes(newStatus as LeadStatus) ? newStatus : availableStatuses[0] ?? ""} onChange={(event) => setNewStatus(event.target.value)}>{availableStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></Field>
            <Field label="Reason (required for Lost or Rejected)"><input className={controlClass} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} /></Field>
            <Button pending={statusPost.pending} disabled={(["LOST", "REJECTED"].includes(newStatus) && !statusReason.trim())} onClick={() => void statusPost.post(`/api/v1/leads/${leadId}/status`, { status: newStatus, reason: statusReason || undefined }, { successMessage: "Lead status updated." })}>Update status</Button>
          </div>
          <FormFeedback error={statusPost.error} success={statusPost.success} />
        </details>
      ) : null}

      {salesOrder ? (
        <section className="rounded-xl border border-emerald-300 bg-card p-4 lg:col-span-2"><p className="text-sm text-muted">Converted to sales order</p><TextLink href={`/sales/${salesOrder.id}`}>View Sales Order {salesOrder.number}</TextLink></section>
      ) : canConvert ? (
        <section className="space-y-3 rounded-xl border border-emerald-300 bg-card p-4 lg:col-span-2">
          <div><h2 className="font-semibold">Create Sales Order</h2><p className="text-sm text-muted">Review the existing customer and every requested line, then confirm once.</p></div>
          <Button onClick={() => setReviewOpen(true)}>Create Sales Order</Button>
          {reviewOpen ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" aria-label="Review sales order">
              <h3 className="font-semibold">Review Sales Order</h3>
              <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted">Customer</dt><dd>{customer.name}</dd></div><div><dt className="text-muted">Contact</dt><dd>{customer.contact} · {customer.phone}</dd></div><div><dt className="text-muted">Email</dt><dd>{customer.email || "Not provided"}</dd></div><div><dt className="text-muted">Address</dt><dd>{customer.address || "Not provided"}</dd></div><div><dt className="text-muted">Customer record</dt><dd>{customer.linked || "Will reuse a matching customer or create one"}</dd></div><div><dt className="text-muted">Required delivery</dt><dd>{promisedDate || "Not specified"}</dd></div></dl>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_150px] sm:items-end">
                    <div><p className="font-medium">{item.productName}</p><p className="text-xs text-muted">{item.quantity} {item.uom} · {Object.entries(item.specifications).filter(([key]) => key !== "categoryId").map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`).join(" · ")}</p></div>
                    <Field label="Sales product"><select className={controlClass} value={productSelections[item.id] || ""} onChange={(event) => setProductSelections((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
                    <Field label="Unit price (optional)"><input className={controlClass} inputMode="decimal" value={prices[item.id] || ""} placeholder="ERP default: 0" onChange={(event) => setPrices((current) => ({ ...current, [item.id]: event.target.value }))} /></Field>
                  </div>
                ))}
              </div>
              <FormFeedback error={convertPost.error} success={convertPost.success} />
              <div className="flex flex-wrap gap-2"><Button pending={convertPost.pending} disabled={items.some((item) => !productSelections[item.id])} onClick={() => void convertPost.post(`/api/v1/leads/${leadId}/convert`, { lines: items.map((item) => ({ leadItemId: item.id, productId: productSelections[item.id], unitPrice: prices[item.id] || undefined })) }, { successMessage: "Sales Order created." })}>Confirm and Create Sales Order</Button><Button tone="ghost" disabled={convertPost.pending} onClick={() => setReviewOpen(false)}>Cancel</Button></div>
            </div>
          ) : null}
        </section>
      ) : null}
      {ConfirmDialog}
    </div>
  );
}

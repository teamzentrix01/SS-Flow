"use client";

import { useState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { toast } from "@/components/toast";
import { LEAD_STATUSES } from "@/modules/leads/status";

export function LeadDetailActions({
  leadId,
  status,
  canVerify,
  canConvert,
  convertDefaults,
}: {
  leadId: string;
  status: string;
  canVerify: boolean;
  canConvert: boolean;
  convertDefaults: {
    lines: { productId: string; qtyOrdered: string; unitPrice: string; uom: string }[];
  };
}) {
  const statusPost = usePost();
  const verifyPost = usePost();
  const convertPost = usePost();
  const [newStatus, setNewStatus] = useState("CONTACTED");
  const [reason, setReason] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {status !== "CONVERTED" ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Update status</h2>
          <Field label="New status">
            <select className={controlClass} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              {LEAD_STATUSES.filter((s) => s !== status).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reason (required for lost/rejected)">
            <input className={controlClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FormFeedback error={statusPost.error} success={statusPost.success} />
          <Button
            pending={statusPost.pending}
            onClick={() => {
              if ((newStatus === "LOST" || newStatus === "REJECTED") && !reason.trim()) {
                toast.error("Please provide a reason when marking a lead as Lost or Rejected.");
                return;
              }
              void statusPost.post(`/api/v1/leads/${leadId}/status`, { status: newStatus, reason: reason || undefined });
            }}
          >
            Save status
          </Button>
        </section>
      ) : null}

      {canVerify ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Verify lead</h2>
          <Field label="Verification notes" required>
            <textarea className={`${controlClass} min-h-[100px]`} value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)} />
          </Field>
          <FormFeedback error={verifyPost.error} success={verifyPost.success} />
          <Button
            pending={verifyPost.pending}
            onClick={() => {
              if (!verifyNotes.trim()) {
                toast.error("Please enter verification notes before marking as verified.");
                return;
              }
              void verifyPost.post(`/api/v1/leads/${leadId}/verify`, { verificationNotes: verifyNotes });
            }}
          >
            Mark verified
          </Button>
        </section>
      ) : null}

      {canConvert ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3 lg:col-span-2">
          <h2 className="font-semibold">Convert to sales order</h2>
          <p className="text-sm text-muted">Confirm pricing and quantities, then create a draft sales order linked to this lead.</p>
          <FormFeedback error={convertPost.error} success={convertPost.success} />
          <Button
            pending={convertPost.pending}
            onClick={() =>
              convertPost.post(
                `/api/v1/leads/${leadId}/convert`,
                { lines: convertDefaults.lines },
                {
                  redirectTo: `/sales`,
                  successMessage: "Sales order created from lead.",
                },
              )
            }
          >
            Convert to sales order
          </Button>
        </section>
      ) : null}
    </div>
  );
}

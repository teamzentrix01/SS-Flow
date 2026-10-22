"use client";

import { useState } from "react";
import { Button, Field, controlClass } from "@/components/ui";
import { FormFeedback } from "@/components/form-feedback";
import { usePost } from "@/components/use-post";
import { toast } from "@/components/toast";

export type JobMaterialCandidate = {
  requestedMaterialId: string;
  requestedMaterial: string;
  batchId: string;
  batchNo: string;
  supplierBatchNo: string | null;
  materialId: string;
  material: string;
  locationId: string;
  location: string;
  availableQty: string;
  reservedQty: string;
  uom: string;
  grade: string | null;
  thickness: string;
  width: string;
  isJobSource: boolean;
};

export function JobMaterialAllocationForm({ jobId, candidates, redirectTo }: { jobId: string; candidates: JobMaterialCandidate[]; redirectTo: string }) {
  const { post, error, success, pending } = usePost();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const selected = candidates.flatMap((candidate) => {
    const qty = quantities[candidate.batchId]?.trim();
    return qty && Number(qty) > 0 ? [{
      requestedMaterialId: candidate.requestedMaterialId,
      batchId: candidate.batchId,
      locationId: candidate.locationId,
      qty,
      uom: candidate.uom,
    }] : [];
  });

  return (
    <form className="space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={(event) => {
      event.preventDefault();
      if (selected.length) void post(`/api/v1/jobs/${jobId}/prepare-material`, { allocations: selected }, redirectTo);
    }}>
      <div>
        <h2 className="font-semibold">Allocate source batches</h2>
        <p className="text-sm text-muted">Same-material batches with required specs are listed. Enter the quantity to reserve from each; partial allocation is allowed.</p>
      </div>
      {candidates.map((candidate) => {
        const max = Number(candidate.availableQty) + (candidate.isJobSource ? Number(candidate.reservedQty) : 0);
        return (
          <div key={`${candidate.requestedMaterialId}-${candidate.batchId}`} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-5">
            <div className="md:col-span-2">
              <p className="font-medium">{candidate.batchNo} · {candidate.material}</p>
              <p className="text-xs text-muted">{candidate.requestedMaterial} · {candidate.location}{candidate.supplierBatchNo ? ` · supplier lot ${candidate.supplierBatchNo}` : ""}</p>
              <p className="text-xs text-muted">Grade {candidate.grade ?? "—"} · {candidate.thickness} × {candidate.width} mm</p>
            </div>
            <p className="self-center text-sm">Available {candidate.availableQty} {candidate.uom}{candidate.isJobSource && Number(candidate.reservedQty) > 0 ? ` · job reserved ${candidate.reservedQty}` : ""}</p>
            <Field label={`Allocate (${candidate.uom})`}>
              <input className={controlClass} type="number" min="0" max={max} step="0.001" value={quantities[candidate.batchId] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [candidate.batchId]: event.target.value }))} />
            </Field>
          </div>
        );
      })}
      {!candidates.length ? <p className="text-sm text-muted">No compatible available batches found. Use the existing automatic reservation action below if stock is already reserved for this job.</p> : null}
      <FormFeedback error={error} success={success} />
      <Button pending={pending}>Reserve selected batches</Button>
    </form>
  );
}

export type JobSubstitutionOption = {
  batchId: string; batchNo: string; materialId: string; material: string;
  locationId: string; location: string; availableQty: string; uom: string;
  grade: string | null; thickness: string;
};

export function MaterialSubstitutionRequestForm({ jobId, requirements, batches, redirectTo }: {
  jobId: string;
  requirements: { id: string; name: string }[];
  batches: JobSubstitutionOption[];
  redirectTo: string;
}) {
  const { post, error, success, pending } = usePost();
  const [requestedMaterialId, setRequestedMaterialId] = useState(requirements[0]?.id ?? "");
  const [batchId, setBatchId] = useState(batches[0]?.batchId ?? "");
  const [requestedQty, setRequestedQty] = useState("");
  const [reason, setReason] = useState("");
  const batch = batches.find((item) => item.batchId === batchId);
  if (!requirements.length || !batches.length) return null;
  return (
    <form className="space-y-3 rounded-xl border border-border bg-card p-4" onSubmit={(event) => {
      event.preventDefault();
      if (batch) void post(`/api/v1/jobs/${jobId}/request-substitution`, {
        requestedMaterialId, batchId, locationId: batch.locationId, requestedQty, uom: batch.uom, reason,
      }, redirectTo);
    }}>
      <h2 className="font-semibold">Request material substitution</h2>
      <p className="text-sm text-muted">Alternative materials stay blocked until a separate purchasing approver approves the request.</p>
      <Field label="Material required by job" required>
        <select className={controlClass} value={requestedMaterialId} onChange={(event) => setRequestedMaterialId(event.target.value)}>
          {requirements.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="QC-passed substitute batch" required>
        <select className={controlClass} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
          {batches.map((item) => <option key={item.batchId} value={item.batchId}>{item.batchNo} · {item.material} · {item.location} · {item.availableQty} {item.uom} · grade {item.grade ?? "—"}</option>)}
        </select>
      </Field>
      <Field label={`Requested quantity (${batch?.uom ?? ""})`} required>
        <input className={controlClass} type="number" min="0.001" max={batch?.availableQty} step="0.001" value={requestedQty} onChange={(event) => setRequestedQty(event.target.value)} />
      </Field>
      <Field label="Reason for substitution" required>
        <textarea className={`${controlClass} min-h-20 py-2`} minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <FormFeedback error={error} success={success} />
      <Button pending={pending}>Send for approval</Button>
    </form>
  );
}

export function MaterialSubstitutionReview({ jobId, requestId, redirectTo }: { jobId: string; requestId: string; redirectTo: string }) {
  const { post, error, success, pending } = usePost();
  const [reason, setReason] = useState("");
  async function decide(decision: "approve" | "reject") {
    if (decision === "reject" && reason.trim().length < 3) {
      toast.error("Please enter a decision note (at least 3 characters) to reject.");
      return;
    }
    await post(`/api/v1/jobs/${jobId}/approve-substitution/${requestId}`, { decision, reason }, redirectTo);
  }
  return (
    <div className="mt-2 space-y-2">
      <Field label="Decision note (required to reject)">
        <input className={controlClass} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button type="button" pending={pending} onClick={() => void decide("approve")}>Approve</Button>
        <Button type="button" pending={pending} tone="danger" onClick={() => void decide("reject")}>Reject</Button>
      </div>
      <FormFeedback error={error} success={success} />
    </div>
  );
}

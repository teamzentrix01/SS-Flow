import Link from "next/link";
import { ShopPrepareMaterial } from "@/components/shop-prepare-material";
import { formatQty, kg, labelFor, when } from "@/lib/format";
import type { ShopJobView } from "@/lib/shop/job-access";

export function ShopAlert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      : tone === "danger"
        ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
        : "border-border bg-muted/20 text-foreground";
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-muted [&_a]:text-accent [&_a]:underline">{children}</div>
    </div>
  );
}

export function ShopJobSummary({ job }: { job: ShopJobView }) {
  const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
  const blocker = job.predecessors.find((link) => link.predecessor.status !== "closed");
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Job</p>
        <p className="text-lg font-semibold">
          {job.number} · {job.name}
        </p>
        <p className="text-sm text-muted">
          {job.productionOrder.product.name} · order target {formatQty(job.targetQty, job.uom)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="font-medium">{labelFor(job.status)}</dd>
        </div>
        <div>
          <dt className="text-muted">Operator</dt>
          <dd className="font-medium">{job.assignee?.name ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt className="text-muted">Machine</dt>
          <dd className="font-medium">{job.machine ? `${job.machine.code} · ${job.machine.name}` : "Not assigned"}</dd>
        </div>
        <div>
          <dt className="text-muted">Material batch</dt>
          <dd className="font-medium">
            {job.batch
              ? `${job.batch.batchNo}${job.batch.material ? ` · ${job.batch.material.name}` : ""}`
              : "Not linked"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Die</dt>
          <dd className="font-medium">{job.die?.code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Allocated</dt>
          <dd className="font-medium">{kg(job.allocatedQty)}</dd>
        </div>
      </dl>
      {locked ? (
        <ShopAlert tone="warning" title="Waiting on previous step">
          Complete and approve {blocker?.predecessor.number ?? "the prior job"} before starting.
        </ShopAlert>
      ) : null}
      {job.instructions ? <p className="text-sm text-muted border-t border-border pt-3">{job.instructions}</p> : null}
    </section>
  );
}

export function ShopStartBlockers({ job }: { job: ShopJobView }) {
  const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
  const issues: { title: string; detail: string }[] = [];
  if (locked) {
    issues.push({
      title: "Previous operation open",
      detail: "This step unlocks when the prior job is closed.",
    });
  }
  if (!job.machineId) {
    issues.push({ title: "No machine", detail: "A supervisor must assign a machine on the sales order or job board." });
  }
  if (!job.batchId) {
    issues.push({
      title: "No material batch",
      detail:
        "Stock was not reserved when the order was approved (often because inventory was empty). Tap Reserve material below after raw stock is in the system.",
    });
  }
  if (job.machine?.status === "down") {
    issues.push({ title: "Machine blocked", detail: "Maintenance must clear the machine before you can start." });
  }
  if (job.status !== "ready") {
    issues.push({
      title: "Not ready to start",
      detail: `Current status is ${labelFor(job.status)}. You can start only when the job is Ready.`,
    });
  }
  if (!issues.length) return null;
  return (
    <div className="space-y-2">
      {issues.map((item) => (
        <ShopAlert key={item.title} tone="warning" title={item.title}>
          {item.detail}
        </ShopAlert>
      ))}
    </div>
  );
}

export function ShopJobActions({
  job,
  isAssignee,
}: {
  job: ShopJobView;
  isAssignee: boolean;
}) {
  if (!isAssignee) {
    return (
      <ShopAlert tone="info" title="Supervisor view">
        Sign in as the assigned operator ({job.assignee?.name ?? "see planner"}) to start or submit this job.
      </ShopAlert>
    );
  }
  const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
  const canStart =
    job.status === "ready" && !locked && Boolean(job.machineId) && Boolean(job.batchId) && job.machine?.status !== "down";

  return (
    <div className="flex flex-col gap-2">
      {job.status === "ready" ? (
        canStart ? (
          <Link className="btn-primary w-full text-center" href={`/shop/jobs/${job.id}/start`}>
            Start job
          </Link>
        ) : (
          <>
            <ShopStartBlockers job={job} />
            {!job.batchId && job.machineId && !locked ? (
              <ShopPrepareMaterial jobId={job.id} redirectTo={`/shop/jobs/${job.id}`} />
            ) : null}
          </>
        )
      ) : null}
      {["in_progress", "paused"].includes(job.status) ? (
        <>
          <Link className="btn-primary w-full text-center" href={`/shop/jobs/${job.id}/active`}>
            Open active job
          </Link>
          <Link className="btn w-full text-center border border-border" href={`/shop/jobs/${job.id}/submit`}>
            Submit output
          </Link>
        </>
      ) : null}
      {job.status === "submitted" ? (
        <ShopAlert tone="info" title="Step marked complete">
          Saved on shop floor. A supervisor must approve this step on the desk before the next operation unlocks.
        </ShopAlert>
      ) : null}
      {job.status === "closed" ? (
        <ShopAlert tone="info" title="Step approved">
          This operation is finished. Check Order routing below for the next step (Forming, Polishing, …).
        </ShopAlert>
      ) : null}
      {job.approvalStatus === "rejected" ? (
        <ShopAlert tone="danger" title="Sent back">
          Update quantities and submit again from the active job screen.
        </ShopAlert>
      ) : null}
    </div>
  );
}

export type ShopRoutingStep = {
  id: string;
  number: string;
  name: string;
  sequence: number;
  status: string;
  assigneeName: string | null;
  assigneeId: string | null;
  isCurrent: boolean;
};

export function ShopRoutingSteps({
  steps,
  viewerEmployeeId,
}: {
  steps: ShopRoutingStep[];
  viewerEmployeeId?: string | null;
}) {
  if (steps.length <= 1) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Order routing</h2>
      <ol className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`rounded-xl border px-3 py-2 text-sm ${
              step.isCurrent ? "border-accent bg-accent-soft" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {step.sequence}. {step.name}
                <span className="font-normal text-muted"> · {step.number}</span>
              </span>
              <span className="text-xs uppercase tracking-wide text-muted">{labelFor(step.status)}</span>
            </div>
            {step.assigneeName ? (
              <p className="text-xs text-muted mt-0.5">{step.assigneeName}</p>
            ) : null}
            {!step.isCurrent && step.status === "closed" ? (
              <p className="text-xs text-success mt-1">Step completed</p>
            ) : null}
            {!step.isCurrent &&
            step.status === "ready" &&
            step.assigneeId &&
            step.assigneeId === viewerEmployeeId ? (
              <Link href={`/shop/jobs/${step.id}`} className="text-xs text-accent mt-1 inline-block">
                Open next step →
              </Link>
            ) : null}
            {!step.isCurrent && step.status === "ready" && !step.assigneeId ? (
              <p className="text-xs text-muted mt-1">Waiting for planner to assign the next operator.</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ShopJobTimeline({ job }: { job: ShopJobView }) {
  const steps = [
    { label: "Assigned", done: Boolean(job.assigneeId) },
    { label: "Ready", done: ["ready", "in_progress", "paused", "submitted", "closed"].includes(job.status) },
    { label: "In progress", done: ["in_progress", "paused", "submitted", "closed"].includes(job.status) },
    { label: "Submitted", done: ["submitted", "closed"].includes(job.status) },
    { label: "Closed", done: job.status === "closed" },
  ];
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {steps.map((step) => (
        <li
          key={step.label}
          className={`rounded-full border px-3 py-1 ${step.done ? "border-primary/30 bg-primary/10 font-medium text-primary" : "border-dashed border-border text-muted"}`}
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export function formatPlanRange(job: ShopJobView) {
  if (!job.plannedStart && !job.plannedEnd) return null;
  return `${job.plannedStart ? when(job.plannedStart) : "—"} → ${job.plannedEnd ? when(job.plannedEnd) : "—"}`;
}

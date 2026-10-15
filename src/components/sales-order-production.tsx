"use client";

import { AssignForm } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { TextLink } from "@/components/ui";
import { formatQty, kg, labelFor, toneFor, when } from "@/lib/format";

export type SalesOrderJobRow = {
  id: string;
  number: string;
  name: string;
  sequence: number;
  status: string;
  targetQty: string;
  targetUom: string;
  instructions: string | null;
  assignee: {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    designation: string | null;
    shiftName: string | null;
    departmentName: string | null;
  } | null;
  machine: { code: string; name: string } | null;
  die: { code: string; name: string } | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  productionOrder: { id: string; number: string; status: string };
  productName: string;
  locked: boolean;
  lockedBy: string | null;
  approvalStatus: string;
  goodQty: string;
  closedAt: string | null;
  stageComplete: boolean;
  awaitingApproval: boolean;
};

const FLOW_STEPS = [
  { key: "draft", label: "Create order" },
  { key: "submitted", label: "Submit" },
  { key: "material_planning", label: "Approve & plan (BOM)" },
  { key: "production", label: "Assign jobs & produce" },
  { key: "ready_for_dispatch", label: "Ready to dispatch" },
  { key: "completed", label: "Completed" },
];

function stepIndex(status: string) {
  if (status === "on_hold" || status === "cancelled") return -1;
  if (status === "partially_dispatched") return FLOW_STEPS.findIndex((s) => s.key === "ready_for_dispatch");
  const idx = FLOW_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function SalesOrderFlowSteps({ status }: { status: string }) {
  const current = stepIndex(status);
  if (current < 0) {
    return <p className="text-sm text-muted">Order is {labelFor(status)}.</p>;
  }
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {FLOW_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={step.key}
            className={`rounded-full border px-3 py-1 ${
              active
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : done
                  ? "border-border bg-muted/30 text-muted"
                  : "border-dashed border-border text-muted"
            }`}
          >
            {index + 1}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}

export function JobAssignmentCard({ job }: { job: SalesOrderJobRow }) {
  const assignee = job.assignee;
  if (!assignee) return null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Assigned operator</p>
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Employee</dt>
          <dd className="mt-0.5 font-medium">
            {assignee.name}
            <span className="font-normal text-muted"> · {assignee.code}</span>
          </dd>
          {assignee.phone ? <dd className="text-muted">{assignee.phone}</dd> : null}
          {assignee.designation ? <dd className="text-muted">{assignee.designation}</dd> : null}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Shift & department</dt>
          <dd className="mt-0.5">{assignee.shiftName ?? "—"}</dd>
          <dd className="text-muted">{assignee.departmentName ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2 border-t border-border/60 pt-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Job on shop floor</dt>
          <dd className="mt-0.5 font-medium">
            {job.number} · Step {job.sequence}: {job.name}
          </dd>
          <dd className="text-muted">
            {job.productName} · target {formatQty(job.targetQty, job.targetUom)}
          </dd>
          {job.machine ? (
            <dd className="mt-1">
              Machine: {job.machine.code} · {job.machine.name}
              {job.die ? ` · Die: ${job.die.code}` : ""}
            </dd>
          ) : null}
          {job.plannedStart || job.plannedEnd ? (
            <dd className="mt-1 text-muted">
              Plan: {job.plannedStart ? when(job.plannedStart) : "—"} →{" "}
              {job.plannedEnd ? when(job.plannedEnd) : "—"}
            </dd>
          ) : null}
        </div>
      </dl>
      {job.status !== "closed" ? (
        <p className="text-sm pt-1">
          <TextLink href={`/shop/jobs/${job.id}`}>Open in shop →</TextLink>
        </p>
      ) : null}
    </div>
  );
}

export function SalesOrderJobAssignPanel({
  salesOrderId,
  jobs,
  canAssign,
  employees,
  machines,
  dies,
}: {
  salesOrderId: string;
  jobs: SalesOrderJobRow[];
  canAssign: boolean;
  employees: { id: string; name: string }[];
  machines: { id: string; name: string }[];
  dies: { id: string; name: string }[];
}) {
  if (!jobs.length) return null;

  const redirectTo = `/sales/${salesOrderId}`;
  const allAssigned = jobs.every((job) => job.assignee);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Job cards (shop floor)</h2>
        <p className="text-sm text-muted">
          {allAssigned
            ? "All steps assigned — operators run jobs in Shop."
            : "Assign each operation here before production starts."}
        </p>
      </div>
      <div className="space-y-4">
        {jobs.map((job) => {
          const assignable =
            canAssign &&
            !job.assignee &&
            !job.locked &&
            ["draft", "assigned", "ready"].includes(job.status);
          return (
            <article key={job.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {job.number} · Step {job.sequence}: {job.name}
                  </p>
                  <p className="text-sm text-muted">
                    {job.productName} · MO{" "}
                    <TextLink href={`/production/${job.productionOrder.id}`}>
                      {job.productionOrder.number}
                    </TextLink>{" "}
                    · target {formatQty(job.targetQty, job.targetUom)}
                  </p>
                  {job.instructions ? (
                    <p className="mt-1 text-xs text-muted">{job.instructions}</p>
                  ) : null}
                  {job.locked ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Waiting on {job.lockedBy ?? "previous step"}.
                    </p>
                  ) : null}
                </div>
                <StatusBadge label={labelFor(job.status)} tone={toneFor(job.status)} />
              </div>
              {job.stageComplete ? (
                <p className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
                  Step completed
                  {job.closedAt ? ` · ${when(job.closedAt)}` : ""}
                  {Number(job.goodQty) > 0 ? ` · good ${kg(job.goodQty)}` : ""}
                </p>
              ) : null}
              {job.awaitingApproval ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                  Operator marked this step complete — waiting for supervisor approval on the desk.
                </p>
              ) : null}
              {!job.assignee ? (
                <p className="text-sm text-muted">Operator: Unassigned</p>
              ) : null}
              {assignable ? (
                <AssignForm
                  jobId={job.id}
                  employees={employees}
                  machines={machines}
                  dies={dies}
                  redirectTo={redirectTo}
                  viaSalesOrder
                />
              ) : null}
              {job.assignee ? <JobAssignmentCard job={job} /> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

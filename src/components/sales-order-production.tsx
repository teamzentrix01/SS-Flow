"use client";

import { AssignForm } from "@/components/forms";
import { StatusBadge } from "@/components/status-badge";
import { TextLink } from "@/components/ui";
import { kg, labelFor, toneFor } from "@/lib/format";

export type SalesOrderJobRow = {
  id: string;
  number: string;
  name: string;
  sequence: number;
  status: string;
  targetQty: string;
  instructions: string | null;
  assignee: { id: string; name: string } | null;
  machine: { code: string; name: string } | null;
  productionOrder: { id: string; number: string; status: string };
  productName: string;
  locked: boolean;
  lockedBy: string | null;
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
            canAssign && !job.locked && ["draft", "assigned", "ready"].includes(job.status);
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
                    · target {kg(job.targetQty)}
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
              <p className="text-sm">
                Operator:{" "}
                <span className="font-medium">{job.assignee?.name ?? "Unassigned"}</span>
                {job.machine ? (
                  <>
                    {" "}
                    · Machine: {job.machine.code} · {job.machine.name}
                  </>
                ) : null}
              </p>
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
              {!assignable && job.assignee && job.status !== "closed" ? (
                <p className="text-sm">
                  <TextLink href={`/shop/jobs/${job.id}`}>Open in shop →</TextLink>
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

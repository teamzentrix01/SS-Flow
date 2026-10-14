import { notFound } from "next/navigation";
import { AssignForm, IdAction, ReasonForm } from "@/components/forms";
import { PageHeader, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor } from "@/lib/format";
import {
  jobDetail,
  listDies,
  listEmployees,
  listMachines,
} from "@/lib/queries";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePage("job.assign");
  const { id } = await params;
  const [job, employees, machines, dies] = await Promise.all([
    jobDetail(id, session.plantIds),
    listEmployees(session.plantIds),
    listMachines(session.plantIds),
    listDies(session.plantIds),
  ]);
  if (!job) notFound();
  const locked = job.predecessors.some(
    (link) => link.predecessor.status !== "closed",
  );
  const salesOrderId = job.productionOrder.salesOrderId;
  const assignOnSalesOrder = Boolean(salesOrderId);
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.number}
        detail={`${job.name} · target ${kg(job.targetQty)}${locked ? " · locked by previous job" : ""}`}
        action={
          <StatusBadge
            label={labelFor(job.status)}
            tone={toneFor(job.status)}
          />
        }
      />
      {["draft", "assigned", "ready"].includes(job.status) && assignOnSalesOrder ? (
        <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          This job belongs to a sales order. Assign the operator from{" "}
          <TextLink href={`/sales/${salesOrderId}`}>the sales order page</TextLink>.
        </p>
      ) : null}
      {["draft", "assigned", "ready"].includes(job.status) && !assignOnSalesOrder ? (
        <AssignForm
          jobId={job.id}
          employees={employees.map((row) => ({ id: row.id, name: row.name }))}
          machines={machines.map((row) => ({
            id: row.id,
            name: `${row.code} · ${row.name}`,
          }))}
          dies={dies.map((row) => ({ id: row.id, name: row.code }))}
        />
      ) : null}
      {job.status === "submitted" && session.permissions.has("job.approve") ? (
        <div className="grid gap-4 md:grid-cols-2">
          <IdAction
            url={`/api/v1/jobs/${job.id}/approve`}
            label="Approve and post output"
            confirmText="Approve this job and post its inventory output? This cannot be undone from this screen."
          />
          <ReasonForm
            url={`/api/v1/jobs/${job.id}/request-correction`}
            label="Send back"
          />
        </div>
      ) : null}
      <p className="text-sm text-muted">
        QC {labelFor(job.qcStatus)} · approval {labelFor(job.approvalStatus)} ·
        good {kg(job.goodQty)}
      </p>
    </div>
  );
}

import { notFound } from "next/navigation";
import { AssignForm, IdAction, ReasonForm } from "@/components/forms";
import {
  JobAssignmentCard,
  type SalesOrderJobRow,
} from "@/components/sales-order-production";
import { PageHeader, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { SimpleTable } from "@/components/ui";
import { formatQty, kg, labelFor, toneFor, when } from "@/lib/format";
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
  const canAssignHere =
    ["draft", "assigned", "ready"].includes(job.status) && !locked;
  const assignmentRow: SalesOrderJobRow | null = job.assignee
    ? {
        id: job.id,
        number: job.number,
        name: job.name,
        sequence: job.sequence,
        status: job.status,
        targetQty: job.targetQty.toString(),
        targetUom: job.uom,
        instructions: job.instructions,
        assignee: {
          id: job.assignee.id,
          name: job.assignee.name,
          code: job.assignee.code,
          phone: job.assignee.phone,
          designation: job.assignee.designation,
          shiftName: job.assignee.shift?.name ?? null,
          departmentName: job.assignee.department?.name ?? null,
        },
        machine: job.machine
          ? { code: job.machine.code, name: job.machine.name }
          : null,
        die: job.die ? { code: job.die.code, name: job.die.name } : null,
        plannedStart: job.plannedStart?.toISOString() ?? null,
        plannedEnd: job.plannedEnd?.toISOString() ?? null,
        productionOrder: {
          id: job.productionOrder.id,
          number: job.productionOrder.number,
          status: job.productionOrder.status,
        },
        productName: job.productionOrder.product.name,
        locked,
        lockedBy: null,
        approvalStatus: job.approvalStatus,
        goodQty: job.goodQty.toString(),
        closedAt: job.closedAt?.toISOString() ?? null,
        stageComplete: job.status === "closed",
        awaitingApproval: job.status === "submitted",
      }
    : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.number}
        detail={`${job.name} · target ${formatQty(job.targetQty, job.uom)}${locked ? " · locked by previous job" : ""}`}
        action={
          <StatusBadge
            label={labelFor(job.status)}
            tone={toneFor(job.status)}
          />
        }
      />
      {canAssignHere && assignOnSalesOrder && !job.assignee ? (
        <p className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
          This job belongs to a sales order. Assign the operator from{" "}
          <TextLink href={`/sales/${salesOrderId}`}>the sales order page</TextLink>.
        </p>
      ) : null}
      {assignmentRow ? <JobAssignmentCard job={assignmentRow} /> : null}
      {canAssignHere && !assignOnSalesOrder ? (
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
      {job.statusEvents.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Stage history</h2>
          <SimpleTable
            columns={["When", "From", "To", "Note"]}
            rows={job.statusEvents.map((ev) => [
              when(ev.createdAt),
              ev.fromStatus ? labelFor(ev.fromStatus) : "—",
              labelFor(ev.toStatus),
              ev.remarks ?? "—",
            ])}
          />
        </section>
      ) : null}
    </div>
  );
}

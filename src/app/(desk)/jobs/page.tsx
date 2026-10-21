import { Plus } from "lucide-react";
import { JobOrderRowActions } from "@/components/masters/job-order-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { EmptyState, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { rollupProductionJobStatus, rollupStatusTone } from "@/lib/domain/job-board";
import { formatQty, when } from "@/lib/format";
import { listJobBoardOrders } from "@/lib/queries";

export default async function JobsPage() {
  const session = await requirePage("job.assign");
  const orders = await listJobBoardOrders(session.plantIds);

  const boardRows = orders.map((order) => {
    const rollup = rollupProductionJobStatus(order.jobs);
    const openJobs = order.jobs.filter((j) => !["closed", "cancelled"].includes(j.status));
    const unassignedSteps = openJobs.filter((j) => !j.assigneeId);
    return { order, rollup, openJobs, unassignedSteps };
  });

  const unassignedOrders = boardRows.filter((row) => row.unassignedSteps.length > 0);
  const inProgressOrders = boardRows.filter(
    (row) => row.rollup.code === "in_progress" || row.rollup.code === "awaiting_approval",
  );

  return (
    <DeskListShell
      title="Job board"
      detail="One row per work order (MO). Open a row to see every routing step, operator, and timestamps."
      action={
        <DeskPrimaryCta href="/jobs/new" icon={Plus}>
          Create job card
        </DeskPrimaryCta>
      }
    >
      <DataTable
        columns={[
          {
            id: "number",
            header: "Work order",
            cell: (row) => row.order.number,
          },
          {
            id: "product",
            header: "Product",
            cell: (row) => row.order.product.name,
          },
          {
            id: "target",
            header: "Target",
            cell: (row) => formatQty(row.order.targetQty, row.order.uom),
          },
          {
            id: "steps",
            header: "Steps",
            cell: (row) =>
              `${row.rollup.closedCount}/${row.rollup.stepCount} done`,
          },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <StatusBadge label={row.rollup.label} tone={rollupStatusTone(row.rollup.code)} />
            ),
          },
          {
            id: "current",
            header: "Current step",
            cell: (row) => row.rollup.currentStepName ?? "—",
          },
          {
            id: "completed",
            header: "Completed",
            cell: (row) => (row.rollup.completedAt ? when(row.rollup.completedAt) : "—"),
          },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[72px] text-right",
            cellClassName: "text-right",
            stopRowClick: true,
            cell: (row) => <JobOrderRowActions productionOrderId={row.order.id} />,
          },
        ]}
        rows={boardRows}
        getRowKey={(row) => row.order.id}
        getRowHref={(row) => `/jobs/orders/${row.order.id}`}
        emptyTitle="No work orders yet"
        emptyDetail="Approve a sales order or release a production order to create job steps."
        emptyAction={
          <DeskPrimaryCta href="/jobs/new" icon={Plus}>
            Create job card
          </DeskPrimaryCta>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Unassigned steps</h2>
          {unassignedOrders.length === 0 ? (
            <EmptyState title="Nothing waiting" detail="Open steps have operators assigned." />
          ) : (
            unassignedOrders.map(({ order, unassignedSteps }) => (
              <TextLink key={order.id} href={`/jobs/orders/${order.id}`}>
                <span className="block rounded-xl border border-border bg-card p-4">
                  <span className="font-medium">{order.number}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {unassignedSteps.map((j) => `${j.sequence}. ${j.name}`).join(" · ")}
                  </span>
                </span>
              </TextLink>
            ))
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold">In process</h2>
          {inProgressOrders.length === 0 ? (
            <EmptyState title="No active work" detail="Completed and not-started orders are in the table above." />
          ) : (
            inProgressOrders.map(({ order, rollup }) => (
              <TextLink key={order.id} href={`/jobs/orders/${order.id}`}>
                <span className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <span>
                    {order.number} · {rollup.currentStepName ?? "—"}
                  </span>
                  <StatusBadge label={rollup.label} tone={rollupStatusTone(rollup.code)} />
                </span>
              </TextLink>
            ))
          )}
        </section>
      </div>
    </DeskListShell>
  );
}

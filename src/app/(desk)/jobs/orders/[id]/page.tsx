import { notFound } from "next/navigation";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { rollupProductionJobStatus, rollupStatusTone } from "@/lib/domain/job-board";
import { formatQty, kg, labelFor, toneFor, when } from "@/lib/format";
import { jobBoardOrderDetail } from "@/lib/queries";

export default async function JobBoardOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("job.assign");
  const { id } = await params;
  const order = await jobBoardOrderDetail(id, session.plantIds);
  if (!order) notFound();

  const rollup = rollupProductionJobStatus(order.jobs);

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.number}
        detail={`${order.product.name} · ${formatQty(order.targetQty, order.uom)} · ${rollup.stepCount} steps`}
        action={
          <StatusBadge label={rollup.label} tone={rollupStatusTone(rollup.code)} />
        }
      />

      <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Overall status</dt>
          <dd className="mt-1 font-medium">{rollup.label}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Steps completed</dt>
          <dd className="mt-1 font-medium">
            {rollup.closedCount} / {rollup.stepCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Completed at</dt>
          <dd className="mt-1 font-medium">{rollup.completedAt ? when(rollup.completedAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Sales order</dt>
          <dd className="mt-1 font-medium">
            {order.salesOrder ? (
              <TextLink href={`/sales/${order.salesOrder.id}`}>{order.salesOrder.number}</TextLink>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Routing steps</h2>
        <p className="text-sm text-muted">
          Each row is one shop-floor step. Open a step for assignment, approval, and full history.
        </p>
        <SimpleTable
          columns={[
            "Step",
            "Job #",
            "Status",
            "Operator",
            "Machine",
            "Started",
            "Finished",
            "Output (good kg)",
          ]}
          rowKeys={order.jobs.map((job) => job.id)}
          rowHrefs={order.jobs.map((job) => `/jobs/${job.id}`)}
          rows={order.jobs.map((job) => {
            const locked = job.predecessors.some((link) => link.predecessor.status !== "closed");
            return [
              <span key={`${job.id}-step`}>
                <span className="font-medium">
                  {job.sequence}. {job.name}
                </span>
                {locked ? (
                  <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-400">
                    Blocked by {job.predecessors.find((l) => l.predecessor.status !== "closed")?.predecessor.name}
                  </span>
                ) : null}
              </span>,
              job.number,
              <StatusBadge
                key={`${job.id}-st`}
                label={labelFor(job.status)}
                tone={toneFor(job.status)}
              />,
              job.assignee?.name ?? "Unassigned",
              job.machine?.code ?? "—",
              job.actualStart ? when(job.actualStart) : "—",
              job.closedAt ? when(job.closedAt) : job.actualEnd ? when(job.actualEnd) : "—",
              Number(job.goodQty) > 0 ? kg(job.goodQty) : "—",
            ];
          })}
        />
      </section>

      {order.jobs.some((j) => j.submissions.length) ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Latest submissions</h2>
          <SimpleTable
            columns={["Step", "Submitted", "Good", "Reject", "Scrap", "Notes"]}
            rows={order.jobs
              .filter((j) => j.submissions[0])
              .map((job) => {
                const sub = job.submissions[0]!;
                return [
                  `${job.sequence}. ${job.name}`,
                  when(sub.createdAt),
                  kg(sub.goodQty),
                  kg(sub.rejectQty),
                  kg(sub.scrapQty),
                  sub.notes ?? "—",
                ];
              })}
          />
        </section>
      ) : null}

      {order.jobs.some((j) => j.statusEvents.length) ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Recent status changes</h2>
          <SimpleTable
            columns={["When", "Step", "From", "To", "Note"]}
            rows={order.jobs.flatMap((job) =>
              job.statusEvents.map((ev) => [
                when(ev.createdAt),
                `${job.sequence}. ${job.name}`,
                ev.fromStatus ? labelFor(ev.fromStatus) : "—",
                labelFor(ev.toStatus),
                ev.remarks ?? "—",
              ]),
            )}
          />
        </section>
      ) : null}
    </div>
  );
}

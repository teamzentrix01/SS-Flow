import { notFound } from "next/navigation";
import { IdAction } from "@/components/forms";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, toneFor } from "@/lib/format";
import { productionDetail } from "@/lib/queries";

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePage("production.manage");
  const { id } = await params;
  const order = await productionDetail(id, session.plantIds);
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <PageHeader
        title={order.number}
        detail={order.product.name}
        action={
          <StatusBadge
            label={labelFor(order.status)}
            tone={toneFor(order.status)}
          />
        }
      />
      {order.status === "draft" ? (
        <IdAction
          url={`/api/v1/production/orders/${order.id}/release`}
          label="Release and reserve material"
        />
      ) : null}
      <SimpleTable
        columns={["Job", "Step", "Status", "Assignee", "Locked by"]}
        rows={order.jobs.map((job) => {
          const blocker = job.predecessors.find(
            (link) => link.predecessor.status !== "closed",
          );
          return [
            <TextLink key={job.id} href={`/jobs/${job.id}`}>
              {job.number}
            </TextLink>,
            job.name,
            labelFor(job.status),
            job.assignee?.name ?? "Unassigned",
            blocker ? blocker.predecessor.number : "—",
          ];
        })}
      />
    </div>
  );
}

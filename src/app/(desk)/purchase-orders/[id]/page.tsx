import Link from "next/link";
import { notFound } from "next/navigation";
import { IdAction } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor } from "@/lib/format";
import { orderDetail } from "@/lib/queries";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("purchase.manage");
  const { id } = await params;
  const order = await orderDetail(id, session.plantIds);
  if (!order) notFound();
  return (
    <div className="space-y-5">
      <PageHeader title={order.number} detail={order.supplier.name} action={<StatusBadge label={labelFor(order.status)} tone={toneFor(order.status)} />} />
      <SimpleTable columns={["Material", "Grade", "Qty", "Received", "Rate"]} rows={order.items.map((item) => [item.description, item.grade ?? "—", kg(item.qty), kg(item.receivedQty), item.rate.toString()])} />
      <div className="flex flex-wrap gap-3">
        {order.status === "pending_approval" && session.permissions.has("purchase.approve") ? <IdAction url={`/api/v1/purchasing/orders/${order.id}/approve`} label="Approve order" /> : null}
        {["approved", "partial"].includes(order.status) ? <Link className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-medium" href={`/receipts/new?order=${order.id}`}>Receive goods</Link> : null}
      </div>
    </div>
  );
}

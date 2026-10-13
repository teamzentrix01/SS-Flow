import { notFound } from "next/navigation";
import { IdAction } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { kg, labelFor, toneFor } from "@/lib/format";
import { salesOrderDetail } from "@/lib/queries";

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("sales.view");
  const { id } = await params;
  const order = await salesOrderDetail(id, session.plantIds);
  if (!order) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={order.number}
        detail={order.customer.name}
        action={<StatusBadge label={labelFor(order.status)} tone={toneFor(order.status)} />}
      />
      <div className="flex flex-wrap gap-2">
        {order.status === "draft" && session.permissions.has("sales.manage") ? (
          <IdAction url={`/api/v1/sales/orders/${order.id}/submit`} label="Submit" />
        ) : null}
        {["submitted", "draft"].includes(order.status) && session.permissions.has("sales.approve") ? (
          <IdAction url={`/api/v1/sales/orders/${order.id}/approve`} label="Approve & plan" />
        ) : null}
      </div>
      <SimpleTable
        columns={["Product", "Ordered", "Produced", "Dispatched", "UOM"]}
        rows={order.items.map((line) => [
          line.product.name,
          kg(line.qtyOrdered),
          kg(line.qtyProduced),
          kg(line.qtyDispatched),
          line.uom,
        ])}
      />
      {order.requirements.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Material requirements</h2>
          <SimpleTable
            columns={["Material", "Gross", "Scrap", "Net"]}
            rows={order.requirements.map((req) => [
              req.material.name,
              kg(req.grossQty),
              kg(req.scrapQty),
              kg(req.netQty),
            ])}
          />
        </section>
      ) : null}
      {order.productionOrders.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Production orders</h2>
          <SimpleTable
            columns={["MO", "Status"]}
            rows={order.productionOrders.map((mo) => [mo.number, mo.status])}
          />
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-semibold">Status history</h2>
        <SimpleTable
          columns={["When", "From", "To", "Remarks"]}
          rows={order.statusEvents.map((ev) => [
            ev.createdAt.toISOString().slice(0, 16),
            ev.fromStatus ?? "—",
            ev.toStatus,
            ev.remarks ?? "—",
          ])}
        />
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { IdAction } from "@/components/forms";
import { SalesOrderProductionSection } from "@/components/sales-order-production.server";
import { SalesOrderDatesEditor } from "@/components/sales-order-dates";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { salesLineRequiresBom } from "@/lib/domain/master-entities";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { salesOrderDetail } from "@/lib/queries";

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("sales.view");
  const { id } = await params;
  const order = await salesOrderDetail(id, session.plantIds);
  if (!order) notFound();
  const portal = order.customer.portalUser;
  const showProduction =
    order.status !== "draft" &&
    order.status !== "submitted" &&
    order.status !== "cancelled";
  const needsBom = order.items.some((line) => salesLineRequiresBom(line.product));
  return (
    <div className="space-y-6">
      <PageHeader
        title={order.number}
        detail="Sales order"
        action={<StatusBadge label={labelFor(order.status)} tone={toneFor(order.status)} />}
      />
      <section className="rounded-xl border border-border bg-card p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Customer order</h2>
        <p className="mt-2 text-lg font-semibold">{order.customer.name}</p>
        <p className="text-sm text-muted">
          Customer code {order.customer.code}
          {order.customer.phone ? ` · ${order.customer.phone}` : ""}
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Portal login</dt>
            <dd className="mt-1 text-sm">
              {portal ? (
                <>
                  {portal.name}
                  <br />
                  <span className="text-muted">{portal.email}</span>
                  {portal.phone ? (
                    <>
                      <br />
                      {portal.phone}
                    </>
                  ) : null}
                  {session.permissions.has("user.manage") ? (
                    <>
                      <br />
                      <TextLink href={`/users/${portal.id}`}>View user account</TextLink>
                    </>
                  ) : null}
                </>
              ) : (
                "No portal account linked"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Products on this order</dt>
            <dd className="mt-1 space-y-1 text-sm">
              {order.items.map((line) => (
                <p key={line.id}>
                  <span className="font-medium">{line.product.name}</span>
                  <span className="text-muted"> · {formatQty(line.qtyOrdered, line.uom)}</span>
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">Schedule</dt>
            <dd className="mt-1 text-sm space-y-1">
              <p>Order date · {when(order.orderDate)}</p>
              <p>Required · {order.requiredDeliveryDate ? when(order.requiredDeliveryDate) : "—"}</p>
              <p>
                Promised · {when(order.promisedDate)}
                {order.requiredDeliveryDate && order.promisedDate && order.promisedDate > order.requiredDeliveryDate ? (
                  <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Later than required
                  </span>
                ) : null}
              </p>
              <p>Priority · {labelFor(order.priority)}</p>
            </dd>
          </div>
        </dl>
        {order.notes || order.productionNotes ? (
          <div className="mt-4 border-t border-border pt-4 text-sm">
            {order.notes ? (
              <p>
                <span className="font-medium">Customer notes:</span> {order.notes}
              </p>
            ) : null}
            {order.productionNotes ? (
              <p className={order.notes ? "mt-2" : ""}>
                <span className="font-medium">Production notes:</span> {order.productionNotes}
              </p>
            ) : null}
          </div>
        ) : null}
        {session.permissions.has("sales.manage") ? (
          <div className="mt-4 border-t border-border pt-3">
            <SalesOrderDatesEditor
              orderId={order.id}
              requiredDeliveryDate={order.requiredDeliveryDate?.toISOString().slice(0, 10)}
              promisedDate={order.promisedDate?.toISOString().slice(0, 10)}
            />
          </div>
        ) : null}
      </section>
      <div className="flex flex-wrap gap-2">
        {order.status === "draft" && session.permissions.has("sales.manage") ? (
          <IdAction url={`/api/v1/sales/orders/${order.id}/submit`} label="Submit for approval" />
        ) : null}
        {["submitted", "draft"].includes(order.status) && session.permissions.has("sales.approve") ? (
          <IdAction
            url={`/api/v1/sales/orders/${order.id}/approve`}
            label={needsBom ? "Approve & plan (BOM)" : "Approve & reserve stock"}
            confirmText={
              needsBom
                ? "Explode BOM, reserve materials, and create job cards for this order?"
                : "Reserve purchased stock for this order? No BOM or production is required."
            }
          />
        ) : null}
      </div>
      <SimpleTable
        columns={["Product", "Ordered", "Produced", "Dispatched"]}
        rows={order.items.map((line) => [
          line.product.name,
          formatQty(line.qtyOrdered, line.uom),
          formatQty(line.qtyProduced, line.uom),
          formatQty(line.qtyDispatched, line.uom),
        ])}
      />
      {order.requirements.length ? (
        <section className="space-y-2">
          <h2 className="font-semibold">Material requirements (from BOM)</h2>
          <p className="text-sm text-muted">
            Net quantities after scrap and loss — used to reserve stock when the order is approved.
          </p>
          <SimpleTable
            columns={["Material", "Gross", "Scrap", "Net"]}
            rows={order.requirements.map((req) => [
              req.material.name,
              formatQty(req.grossQty, req.uom),
              formatQty(req.scrapQty, req.uom),
              formatQty(req.netQty, req.uom),
            ])}
          />
        </section>
      ) : null}
      {showProduction ? <SalesOrderProductionSection order={order} session={session} /> : null}
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

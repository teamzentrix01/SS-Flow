import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelPurchaseOrderForm, IdAction } from "@/components/forms";
import { canCancelPo } from "@/modules/procurement/domain";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { formatQty, labelFor, money, toneFor, when } from "@/lib/format";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { orderDetail } from "@/lib/queries";

function outstanding(item: { qty: { toString(): string }; receivedQty: { toString(): string } }) {
  const open = toMilli(item.qty.toString()) - toMilli(item.receivedQty.toString());
  return open > 0n ? open : 0n;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("purchase.manage");
  const { id } = await params;
  const plantIds = await plantIdsForSession(session);
  const order = await orderDetail(id, plantIds);
  if (!order) notFound();
  const receivable = ["approved", "sent", "partial"].includes(order.status);
  const showCancel = canCancelPo(order.status) && session.permissions.has("purchase.cancel");
  return (
    <div className="space-y-5">
      <PageHeader
        title={order.number}
        detail={`${order.supplier.name} · Receiving factory: ${order.plant.name}`}
        action={<StatusBadge label={labelFor(order.status)} tone={toneFor(order.status)} />}
      />
      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
        <p>Expected delivery: {when(order.expectedDate)}</p>
        <p>Submitted: {when(order.submittedAt)}</p>
        {order.paymentTerms ? <p>Payment terms: {order.paymentTerms}</p> : null}
        {order.deliveryTerms ? <p>Delivery terms: {order.deliveryTerms}</p> : null}
      </div>
      {order.notes ? <p className="text-sm whitespace-pre-wrap">{order.notes}</p> : null}
      <SimpleTable
        columns={["Material", "Grade", "Ordered", "Received", "Rejected", "Outstanding", "Rate", "Tax"]}
        rows={order.items.map((item) => {
          const open = outstanding(item);
          return [
            item.description,
            item.grade ?? "—",
            formatQty(item.qty, item.uom),
            formatQty(item.receivedQty, item.uom),
            formatQty(item.rejectedQty, item.uom),
            formatQty(fromMilli(open), item.uom),
            money(item.rate),
            `${Number(item.taxPct)}%`,
          ];
        })}
      />
      {order.receipts.length ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Goods receipts</h2>
          <SimpleTable
            columns={["GRN", "Status", "Received", "Posted"]}
            rowKeys={order.receipts.map((receipt) => receipt.id)}
            rowHrefs={order.receipts.map((receipt) => `/receipts/${receipt.id}`)}
            rows={order.receipts.map((receipt) => [
              receipt.number,
              labelFor(receipt.status),
              when(receipt.receivedAt),
              when(receipt.postedAt),
            ])}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-medium"
          href={`/purchase-orders/${order.id}/print`}
          target="_blank"
        >
          Printable PO
        </Link>
        {order.status === "draft" && session.permissions.has("purchase.submit") ? (
          <IdAction url={`/api/v1/purchasing/orders/${order.id}/submit`} label="Submit for approval" />
        ) : null}
        {order.status === "pending_approval" && session.permissions.has("purchase.approve") ? (
          <IdAction url={`/api/v1/purchasing/orders/${order.id}/approve`} label="Approve order" />
        ) : null}
        {order.status === "approved" && session.permissions.has("purchase.manage") ? (
          <IdAction url={`/api/v1/purchasing/orders/${order.id}/send`} label="Mark sent to supplier" />
        ) : null}
        {receivable ? (
          <Link
            className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-medium"
            href={`/receipts/new?order=${order.id}`}
          >
            Record goods receipt
          </Link>
        ) : null}
      </div>
      {showCancel ? <CancelPurchaseOrderForm orderId={order.id} /> : null}
    </div>
  );
}

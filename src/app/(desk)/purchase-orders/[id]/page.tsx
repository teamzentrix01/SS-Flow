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
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">PO Line Reconciliation</h2>
        <SimpleTable
          columns={[
            "Material",
            "Grade",
            "Ordered",
            "Delivered",
            "QC Accepted",
            "QC Rejected",
            "Pending QC",
            "Outstanding",
            "Over-receipt",
            "Rate",
          ]}
          rows={order.items.map((item) => {
            const orderedQty = Number(item.qty);
            const cumulativeAccepted = Number(item.receivedQty);
            const qcRejected = Number(item.rejectedQty);
            const open = outstanding(item);
            const postedItems = item.receiptItems?.filter((r) => r.receipt?.status === "posted") ?? [];
            const totalDelivered = postedItems.reduce((sum, r) => sum + Number(r.deliveredQty), 0);
            const pendingQc = postedItems
              .filter((r) => r.inspectionStatus === "pending")
              .reduce((sum, r) => sum + Number(r.acceptedQty), 0);
            const qcAccepted = Math.max(0, cumulativeAccepted - pendingQc);
            const overReceived = totalDelivered > orderedQty ? totalDelivered - orderedQty : 0;

            return [
              item.description,
              item.grade ?? "—",
              formatQty(item.qty, item.uom),
              formatQty(totalDelivered.toString(), item.uom),
              <span key="acc" className="text-success font-medium">{formatQty(qcAccepted.toString(), item.uom)}</span>,
              qcRejected > 0 ? (
                <span key="rej" className="text-danger font-medium">{formatQty(item.rejectedQty, item.uom)}</span>
              ) : (
                "0"
              ),
              pendingQc > 0 ? (
                <span key="pnd" className="text-warning font-medium">{formatQty(pendingQc.toString(), item.uom)}</span>
              ) : (
                "0"
              ),
              formatQty(fromMilli(open), item.uom),
              overReceived > 0 ? (
                <span key="ovr" className="rounded bg-warning/20 px-1.5 py-0.5 text-xs font-semibold text-warning">
                  +{formatQty(overReceived.toString(), item.uom)}
                </span>
              ) : (
                "—"
              ),
              money(item.rate),
            ];
          })}
        />
      </div>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { IdAction } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { formatQty, labelFor, toneFor, when } from "@/lib/format";
import { receiptDetail } from "@/lib/queries";

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("purchase.manage");
  const { id } = await params;
  const receipt = await receiptDetail(id, session.plantIds);
  if (!receipt) notFound();

  const hasFactoryMismatch = receipt.intendedPlantId && receipt.intendedPlantId !== receipt.plantId;

  return (
    <div className="space-y-5">
      <PageHeader
        title={receipt.number}
        detail={`${receipt.order.number} · ${receipt.order.supplier.name} · ${receipt.plant.name}`}
        action={<StatusBadge label={labelFor(receipt.status)} tone={toneFor(receipt.status)} />}
      />
      {hasFactoryMismatch && (
        <div className="rounded-lg border border-warning-soft bg-warning-soft p-4 text-warning">
          <p className="font-medium">Factory Mismatch</p>
          <p className="text-sm">
            PO intended for <strong>{receipt.intendedPlant?.name}</strong> but received at{" "}
            <strong>{receipt.plant.name}</strong>
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Received {when(receipt.receivedAt)}
        {receipt.postedAt ? ` · Posted ${when(receipt.postedAt)}` : null}
      </p>
      <SimpleTable
        columns={["Material", "Delivered", "Accepted", "Rejected", "Batch / heat", "Inspection"]}
        rows={receipt.items.map((item) => [
          item.orderItem.description,
          formatQty(item.deliveredQty, item.uom),
          formatQty(item.acceptedQty, item.uom),
          formatQty(item.rejectedQty, item.uom),
          `${item.batchNo}${item.heatNo ? ` · ${item.heatNo}` : ""}`,
          labelFor(item.inspectionStatus),
        ])}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          className="inline-flex h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-medium"
          href={`/purchase-orders/${receipt.orderId}`}
        >
          Back to PO
        </Link>
        {receipt.status === "draft" && session.permissions.has("inventory.receive") ? (
          <IdAction url={`/api/v1/purchasing/receipts/${receipt.id}/post`} label="Post to inventory" />
        ) : null}
      </div>
    </div>
  );
}

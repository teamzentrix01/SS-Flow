import { notFound } from "next/navigation";
import { ReceiptForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listLocations, orderDetail } from "@/lib/queries";

export default async function ReceiptPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const session = await requirePage("purchase.manage");
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();
  const [order, locations] = await Promise.all([orderDetail(orderId, session.plantIds), listLocations(session.plantIds)]);
  if (!order) notFound();
  return (
    <div>
      <PageHeader title={`Receive ${order.number}`} detail="Accepted lines go to QC hold until inspection." />
      <ReceiptForm orderId={order.id} locations={locations.map((row) => ({ id: row.id, label: `${row.warehouse.code} / ${row.code}` }))} lines={order.items.map((item) => ({ id: item.id, label: `${item.description} · open ${Number(item.qty) - Number(item.receivedQty)} kg` }))} />
    </div>
  );
}

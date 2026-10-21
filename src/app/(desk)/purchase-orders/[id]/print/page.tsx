import { notFound } from "next/navigation";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { kg, money, when } from "@/lib/format";
import { orderDetail } from "@/lib/queries";

export default async function PurchaseOrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("purchase.manage");
  const { id } = await params;
  const plantIds = await plantIdsForSession(session);
  const order = await orderDetail(id, plantIds);
  if (!order) notFound();
  const total = order.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.rate), 0);
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-black print:p-0">
      <header className="border-b border-neutral-300 pb-4">
        <h1 className="text-2xl font-semibold">Purchase order {order.number}</h1>
        <p className="text-sm">
          {order.plant.name} · Supplier: {order.supplier.name} · Status: {order.status.replaceAll("_", " ")}
        </p>
        <p className="text-sm">
          Expected: {when(order.expectedDate)} · Created: {when(order.createdAt)}
        </p>
        {order.paymentTerms ? <p className="text-sm">Payment: {order.paymentTerms}</p> : null}
        {order.deliveryTerms ? <p className="text-sm">Delivery: {order.deliveryTerms}</p> : null}
      </header>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-2">Item</th>
            <th>Specs</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Tax</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-200">
              <td className="py-2">{item.description}</td>
              <td>
                {[item.grade, item.thickness && `${item.thickness} mm`, item.width && `W ${item.width}`]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td>{kg(item.qty)}</td>
              <td>{money(item.rate)}</td>
              <td>{Number(item.taxPct).toLocaleString()}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right font-medium">Total (excl. tax): {money(total)}</p>
      {order.notes ? <p className="text-sm whitespace-pre-wrap">Notes: {order.notes}</p> : null}
      <p className="hidden print:block text-center text-xs text-neutral-500">Generated from SS Metals ERP</p>
    </div>
  );
}

import { DispatchForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { CustomerForm } from "@/components/master-forms";
import { EmptyState, PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { kg, when } from "@/lib/format";
import { finishedBatches, listCustomers, listSalesOrders, listShipments } from "@/lib/queries";

export default async function DispatchPage() {
  const session = await requirePage("dispatch.manage");
  const [customers, batches, shipments, salesOrders] = await Promise.all([
    listCustomers(session.plantIds),
    finishedBatches(session.plantIds),
    listShipments(session.plantIds),
    listSalesOrders(session.plantIds),
  ]);
  const salesLines = salesOrders.flatMap((order) =>
    order.items
      .filter((line) => Number(line.qtyDispatched) < Number(line.qtyOrdered))
      .map((line) => ({
        id: line.id,
        customerId: order.customerId,
        label: `${order.number} · ${line.product.name} · open ${Number(line.qtyOrdered) - Number(line.qtyDispatched)} ${line.uom}`,
      })),
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Dispatch" detail="Quality-passed finished goods or reserved purchased stock can leave." action={<CreateDialog label="Create customer" title="Create customer"><CustomerForm /></CreateDialog>} />
      {!customers.length ? (
        <EmptyState title="Create a customer first" detail="Dispatch needs a customer and quality-passed stock." />
      ) : !batches.length ? (
        <EmptyState title="No stock is ready to dispatch" detail="Finish production QC, or approve a sales order that reserved purchased stock." />
      ) : (
        <section className="space-y-3">
          <div><h2 className="font-semibold">New dispatch</h2><p className="text-sm text-muted">Choose a customer and finished batch, then confirm the quantity.</p></div>
          <DispatchForm customers={customers.map((row) => ({ id: row.id, name: row.name }))} batches={batches} salesLines={salesLines} />
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Recent shipments</h2>
        <SimpleTable emptyTitle="No shipments yet" emptyDetail="Dispatch only quality-passed finished kilograms. A shipment appears here after it leaves." columns={["Shipment", "Customer", "When", "Qty"]} rows={shipments.map((row) => [row.number, row.order.customer.name, when(row.shippedAt), kg(row.items.reduce((sum, item) => sum + Number(item.qty), 0))])} />
      </section>
    </div>
  );
}

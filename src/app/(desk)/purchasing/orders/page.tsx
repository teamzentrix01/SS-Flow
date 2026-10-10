import { PurchaseForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { labelFor, money, toneFor, when } from "@/lib/format";
import { listMaterials, listOrders, listSuppliers } from "@/lib/queries";

export default async function OrdersPage() {
  const session = await requirePage("purchase.manage");
  const [orders, suppliers, materials] = await Promise.all([
    listOrders(session.plantIds),
    listSuppliers(session.plantIds),
    listMaterials(session.plantIds),
  ]);
  return (
    <div>
      <PageHeader
        title="Purchase orders"
        detail="Approve an order before the warehouse can receive it."
        action={
          <CreateDialog label="New order" title="New purchase order">
            <PurchaseForm
              suppliers={suppliers.map((row) => ({ id: row.id, name: row.name }))}
              materials={materials.map((row) => ({ id: row.id, name: row.name }))}
            />
          </CreateDialog>
        }
      />
      <SimpleTable
        emptyTitle="No purchase orders"
        emptyDetail="Create an order for a coil. After approval, receive it so incoming QC and stock can start."
        columns={["Number", "Supplier", "Status", "Expected", "Value"]}
        rows={orders.map((order) => {
          const value = order.items.reduce(
            (sum, item) => sum + Number(item.qty) * Number(item.rate),
            0,
          );
          return [
            <TextLink key={order.id} href={`/purchasing/orders/${order.id}`}>
              {order.number}
            </TextLink>,
            order.supplier.name,
            <StatusBadge
              key={order.id}
              label={labelFor(order.status)}
              tone={toneFor(order.status)}
            />,
            when(order.expectedDate),
            money(value),
          ];
        })}
      />
    </div>
  );
}

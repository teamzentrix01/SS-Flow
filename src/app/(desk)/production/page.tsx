import { ProductionForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { requirePage } from "@/lib/access";
import { formatQty, kg, labelFor, toneFor } from "@/lib/format";
import { availableBatches, listMaterials, listProduction } from "@/lib/queries";

export default async function ProductionPage() {
  const session = await requirePage("production.manage");
  const [orders, materials, batches] = await Promise.all([
    listProduction(session.plantIds),
    listMaterials(session.plantIds),
    availableBatches(session.plantIds),
  ]);
  return (
    <div>
      <PageHeader
        title="Production"
        detail="Release an order to reserve the source batch and open its jobs."
        action={
          <CreateDialog label="Create production order" title="Create production order">
            <ProductionForm
              products={materials.map((item) => ({ id: item.id, name: item.name }))}
              batches={batches}
            />
          </CreateDialog>
        }
      />
      <SimpleTable
        emptyTitle="No production orders"
        emptyDetail="A production order needs available stock. Create one after incoming QC has released a coil."
        columns={["Number", "Product", "Input", "Target", "Status"]}
        rowKeys={orders.map((order) => order.id)}
        rowHrefs={orders.map((order) => `/production/${order.id}`)}
        rows={orders.map((order) => [
          order.number,
          order.product.name,
          kg(order.inputQty),
          formatQty(order.targetQty, order.uom),
          <StatusBadge
            key={order.id}
            label={labelFor(order.status)}
            tone={toneFor(order.status)}
          />,
        ])}
      />
    </div>
  );
}

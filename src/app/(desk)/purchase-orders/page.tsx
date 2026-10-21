import { PurchaseForm } from "@/components/forms";
import { CreateDialog } from "@/components/create-dialog";
import { PageHeader, SimpleTable } from "@/components/ui";
import { StatusBadge } from "@/components/status-badge";
import { plantIdsForSession, requirePage } from "@/lib/access";
import { labelFor, money, toneFor, when } from "@/lib/format";
import { ensurePortalSupplierRecords } from "@/lib/masters";
import { listAllMaterials, listAllSuppliers, listOrders, listPlants } from "@/lib/queries";
import { listAllProductCategories } from "@/modules/masters/categories";
import { listAllUnits } from "@/modules/masters/product-catalog";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    supplier?: string;
    plant?: string;
    status?: string;
    category?: string;
    material?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const session = await requirePage("purchase.manage");
  const plantIds = await plantIdsForSession(session);
  await ensurePortalSupplierRecords(session.plantIds, session.userId);
  const filters = await searchParams;
  const [orders, suppliers, materials, plants, units, categories] = await Promise.all([
    listOrders(plantIds, {
      supplierId: filters.supplier,
      plantId: filters.plant,
      status: filters.status,
      categoryId: filters.category,
      materialId: filters.material,
      from: filters.from,
      to: filters.to,
    }),
    listAllSuppliers(),
    listAllMaterials({ purchaseOnly: false }),
    listPlants(plantIds),
    listAllUnits(),
    listAllProductCategories(),
  ]);
  const unitSymbols = [...new Set(units.map((row) => row.symbol.toUpperCase()))].sort();
  const plantNameById = new Map(plants.map((row) => [row.id, row.name]));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase orders"
        detail="Draft → submit → approve → send → receive. Stock posts only when a GRN is posted."
        action={
          <CreateDialog label="Create purchase order" title="Create purchase order">
            <PurchaseForm
              plants={plants.map((row) => ({ id: row.id, name: row.name }))}
              suppliers={suppliers.map((row) => ({
                id: row.id,
                name: row.name,
                code: row.code,
                plantId: row.plantId,
                plantName: row.plant.name ?? plantNameById.get(row.plantId),
                contact: row.contact ?? undefined,
              }))}
              materials={materials.map((row) => ({
                id: row.id,
                name: row.name,
                code: row.code,
                plantId: row.plantId,
                plantName: plantNameById.get(row.plantId),
                uom: (row.purchaseUom || row.uom || "KG").toUpperCase(),
              }))}
              units={unitSymbols}
            />
          </CreateDialog>
        }
      />
      <form method="get" action="/purchase-orders" className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3 lg:grid-cols-6">
        <select name="plant" defaultValue={filters.plant ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm">
          <option value="">All factories</option>
          {plants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="supplier" defaultValue={filters.supplier ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm">
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm">
          <option value="">All statuses</option>
          {["draft", "pending_approval", "approved", "sent", "partial", "received", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {labelFor(s)}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={filters.category ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="material" defaultValue={filters.material ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm">
          <option value="">All materials</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.code})
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={filters.from ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm" />
        <input type="date" name="to" defaultValue={filters.to ?? ""} className="h-10 rounded-lg border border-border px-2 text-sm" />
        <button type="submit" className="h-10 rounded-lg bg-steel text-sm font-medium text-white md:col-span-2 lg:col-span-1">
          Filter
        </button>
      </form>
      <SimpleTable
        emptyTitle="No purchase orders"
        emptyDetail="Create an order for incoming steel. Receipts update factory inventory when posted."
        columns={["Number", "Factory", "Supplier", "Status", "Expected", "Value"]}
        rowKeys={orders.map((order) => order.id)}
        rowHrefs={orders.map((order) => `/purchase-orders/${order.id}`)}
        rows={orders.map((order) => {
          const value = order.items.reduce((sum, item) => sum + Number(item.qty) * Number(item.rate), 0);
          return [
            order.number,
            order.plant.name,
            order.supplier.name,
            <StatusBadge key={`${order.id}-s`} label={labelFor(order.status)} tone={toneFor(order.status)} />,
            when(order.expectedDate),
            money(value),
          ];
        })}
      />
    </div>
  );
}

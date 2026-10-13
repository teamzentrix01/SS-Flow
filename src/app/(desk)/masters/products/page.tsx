import { Plus } from "lucide-react";
import { ProductRowActions } from "@/components/masters/product-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listProductsForDesk } from "@/lib/queries";
import { listProductCategories } from "@/modules/masters/categories";

export default async function ProductsPage() {
  const session = await requirePage("plant.manage");
  const products = await listProductsForDesk(session.plantIds);
  return (
    <DeskListShell
      title="Products & materials"
      detail="Utensil finished goods use PCS; steel raw stock stays on KG batches."
      action={
        <DeskPrimaryCta href="/masters/products/new" icon={Plus}>
          New product
        </DeskPrimaryCta>
      }
    >
      <DataTable
        columns={[
          { id: "code", header: "Code", cell: (row) => row.code },
          { id: "name", header: "Name", cell: (row) => row.name },
          {
            id: "category",
            header: "Category",
            cell: (row) => row.productCategory?.name ?? row.category,
          },
          {
            id: "type",
            header: "Type",
            cell: (row) => row.productType.replaceAll("_", " "),
          },
          { id: "uom", header: "UOM", cell: (row) => row.uom },
          {
            id: "status",
            header: "Status",
            cell: (row) => (row.active ? "Active" : "Inactive"),
          },
          {
            id: "actions",
            header: "",
            headerClassName: "w-[140px] text-right",
            cellClassName: "text-right",
            cell: (row) => (
              <ProductRowActions id={row.id} showBom={row.category === "utensil" || row.productType === "finished"} />
            ),
          },
        ]}
        rows={products}
        getRowKey={(row) => row.id}
        emptyTitle="No products yet"
        emptyDetail="Add raw materials, semi-finished items, finished goods, and consumables."
        emptyAction={
          <DeskPrimaryCta href="/masters/products/new" icon={Plus}>
            New product
          </DeskPrimaryCta>
        }
      />
    </DeskListShell>
  );
}

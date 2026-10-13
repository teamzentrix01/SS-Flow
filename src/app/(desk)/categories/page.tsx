import { Plus } from "lucide-react";
import { CategoryRowActions } from "@/components/masters/category-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listProductCategories } from "@/modules/masters/categories";

export default async function CategoriesPage() {
  const session = await requirePage("plant.manage");
  const categories = await listProductCategories(session.plantIds, { activeOnly: false });
  return (
    <DeskListShell
      title="Product categories"
      detail="Categories classify products. Inventory buckets (available, reserved, QC hold, WIP) stay on stock balances."
      action={
        <DeskPrimaryCta href="/categories/new" icon={Plus}>
          New category
        </DeskPrimaryCta>
      }
    >
      <DataTable
        columns={[
          { id: "code", header: "Code", cell: (row) => row.code },
          { id: "name", header: "Name", cell: (row) => row.name },
          {
            id: "type",
            header: "Type",
            cell: (row) => row.categoryType.replaceAll("_", " "),
          },
          { id: "form", header: "Form", cell: (row) => row.productForm ?? "—" },
          { id: "parent", header: "Parent", cell: (row) => row.parent?.name ?? "—" },
          { id: "status", header: "Status", cell: (row) => row.status },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[120px] text-right",
            cellClassName: "text-right",
            cell: (row) => (
              <CategoryRowActions
                id={row.id}
                canDelete={row._count.products === 0 && row._count.children === 0}
              />
            ),
          },
        ]}
        rows={categories}
        getRowKey={(row) => row.id}
        emptyTitle="No categories yet"
        emptyDetail="Create a hierarchy for raw materials, WIP, finished goods, consumables, and scrap."
        emptyAction={
          <DeskPrimaryCta href="/categories/new" icon={Plus}>
            New category
          </DeskPrimaryCta>
        }
      />
    </DeskListShell>
  );
}

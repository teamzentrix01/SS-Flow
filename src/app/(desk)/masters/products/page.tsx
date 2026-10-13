import Link from "next/link";
import { MaterialForm } from "@/components/master-forms";
import { CreateDialog } from "@/components/create-dialog";
import { PageHeader, SimpleTable, TextLink } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listUtensilProducts } from "@/lib/queries";

export default async function ProductsPage() {
  const session = await requirePage("plant.manage");
  const products = await listUtensilProducts(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & materials"
        detail="Utensil finished goods use PCS; steel raw stock stays on KG batches."
        action={
          <CreateDialog label="New product" title="New material master">
            <MaterialForm />
          </CreateDialog>
        }
      />
      <SimpleTable
        columns={["Code", "Name", "Category", "UOM", "BOM"]}
        rows={products.map((row) => [
          row.code,
          row.name,
          row.category,
          row.uom,
          row.category === "utensil" ? (
            <TextLink key={row.id} href={`/masters/products/${row.id}/bom`}>BOM</TextLink>
          ) : (
            "—"
          ),
        ])}
      />
      <p className="text-sm text-muted">
        Conventions are documented in{" "}
        <Link className="text-steel underline" href="/settings">plant setup</Link>.
      </p>
    </div>
  );
}

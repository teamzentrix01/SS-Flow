import { CreateDialog } from "@/components/create-dialog";
import { SupplierForm } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { listSuppliers } from "@/lib/queries";

export default async function SuppliersPage() {
  const session = await requirePage("purchase.manage");
  const suppliers = await listSuppliers(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Suppliers" action={<CreateDialog label="Create supplier" title="Create supplier"><SupplierForm /></CreateDialog>} />
      <SimpleTable columns={["Code", "Name", "Phone"]} rows={suppliers.map((row) => [row.code, row.name, row.phone ?? "—"])} />
    </div>
  );
}

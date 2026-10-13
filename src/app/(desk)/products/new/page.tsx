import { MaterialForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listProductCategories } from "@/modules/masters/categories";

export default async function NewProductPage() {
  const session = await requirePage("plant.manage");
  const categories = await listProductCategories(session.plantIds);
  return (
    <DeskFormPage title="Create product" backHref="/products" backLabel="Back to products">
      <MaterialForm categories={categories.map((row) => ({ id: row.id, name: row.name, code: row.code }))} />
    </DeskFormPage>
  );
}

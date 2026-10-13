import { CategoryForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listProductCategories } from "@/modules/masters/categories";

export default async function NewCategoryPage() {
  const session = await requirePage("plant.manage");
  const categories = await listProductCategories(session.plantIds, { activeOnly: false });
  return (
    <DeskFormPage title="Create category" backHref="/masters/categories" backLabel="Back to categories">
      <CategoryForm parents={categories.map((row) => ({ id: row.id, name: row.name }))} />
    </DeskFormPage>
  );
}

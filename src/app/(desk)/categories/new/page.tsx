import { CategoryForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { decorateCategories } from "@/lib/domain/business-categories";
import { listProductCategories } from "@/modules/masters/categories";

export default async function NewCategoryPage() {
  const session = await requirePage("plant.manage");
  const categories = decorateCategories(await listProductCategories(session.plantIds, { activeOnly: false }));
  return (
    <DeskFormPage
      title="Create subcategory"
      detail="Add a product type under Trading Products or Manufactured Products. Those two business lines cannot be duplicated."
      backHref="/products?tab=categories"
      backLabel="Back to categories"
    >
      <CategoryForm
        parents={categories.map((row) => ({
          id: row.id,
          name: row.name,
          isBusinessRoot: row.isBusinessRoot,
          businessKind: row.businessKind,
        }))}
      />
    </DeskFormPage>
  );
}

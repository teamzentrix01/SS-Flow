import { CategoryForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getProductCategory, listProductCategories } from "@/modules/masters/categories";
import { notFound } from "next/navigation";

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  const [category, categories] = await Promise.all([
    getProductCategory(id, session.plantIds),
    listProductCategories(session.plantIds, { activeOnly: false }),
  ]);
  if (!category) notFound();
  const parents = categories.filter((row) => row.id !== id).map((row) => ({ id: row.id, name: row.name }));
  return (
    <DeskFormPage title="Edit category" backHref={`/categories/${id}`} backLabel="Back to category">
      <CategoryForm
        categoryId={id}
        parents={parents}
        redirectTo={`/categories/${id}`}
        submitLabel="Save changes"
        initial={{
          code: category.code,
          name: category.name,
          parentId: category.parentId ?? "",
          categoryType: category.categoryType as "raw_material" | "wip" | "finished_goods" | "consumable" | "scrap",
          productForm: category.productForm ?? "",
          description: category.description ?? "",
          status: category.status as "active" | "inactive",
        }}
      />
    </DeskFormPage>
  );
}

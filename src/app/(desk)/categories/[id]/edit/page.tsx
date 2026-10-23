import { CategoryForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { decorateCategories, isBusinessRootCode } from "@/lib/domain/business-categories";
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
  const decorated = decorateCategories(categories);
  const isRoot = isBusinessRootCode(category.code);
  const parents = decorated
    .filter((row) => row.id !== id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      isBusinessRoot: row.isBusinessRoot,
      businessKind: row.businessKind,
    }));
  return (
    <DeskFormPage title={isRoot ? "Business category" : "Edit subcategory"} backHref={`/categories/${id}`} backLabel="Back to category">
      <CategoryForm
        categoryId={id}
        parents={parents}
        isBusinessRoot={isRoot}
        redirectTo={`/categories/${id}`}
        submitLabel="Save changes"
        initial={{
          code: category.code,
          name: category.name,
          parentId: category.parentId ?? "",
          categoryType: category.categoryType as "raw_material" | "wip" | "finished_goods" | "consumable" | "scrap",
          productForm: category.productForm ?? "",
          requiredSpecs: category.requiredSpecs as import("@/lib/domain/material-specifications").MaterialSpecKey[],
          description: category.description ?? "",
          status: category.status as "active" | "inactive",
        }}
      />
    </DeskFormPage>
  );
}

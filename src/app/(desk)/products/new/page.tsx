import { ProductCreateForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { decorateCategories } from "@/lib/domain/business-categories";
import { listProductCategories } from "@/modules/masters/categories";
import { listDistinctUnits } from "@/modules/masters/product-catalog";

export default async function NewProductPage() {
  const session = await requirePage("plant.manage");
  const [categories, units] = await Promise.all([
    listProductCategories(session.plantIds, { activeOnly: false }),
    listDistinctUnits(),
  ]);
  const decorated = decorateCategories(categories);
  return (
    <DeskFormPage
      title="Create product"
      detail="Choose Trading Products or Manufactured Products first, then the subcategory and unit."
      backHref="/products?tab=products"
      backLabel="Back to product catalog"
    >
      <ProductCreateForm
        categories={decorated.map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          parentId: row.parentId,
          requiredSpecs: row.requiredSpecs,
          businessKind: row.businessKind,
          isBusinessRoot: row.isBusinessRoot,
        }))}
        units={units.map((row) => ({ symbol: row.symbol, name: row.name }))}
      />
    </DeskFormPage>
  );
}

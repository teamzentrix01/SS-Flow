import { ProductCreateForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listAllProductCategories } from "@/modules/masters/categories";
import { listDistinctUnits } from "@/modules/masters/product-catalog";

export default async function NewProductPage() {
  await requirePage("plant.manage");
  const [categories, units] = await Promise.all([listAllProductCategories(), listDistinctUnits()]);
  return (
    <DeskFormPage
      title="Create product"
      detail="Set SKU, category, and unit in one step. New categories and units can be added from the dropdowns."
      backHref="/products?tab=products"
      backLabel="Back to product catalog"
    >
      <ProductCreateForm
        categories={categories.map((row) => ({ id: row.id, name: row.name, code: row.code, requiredSpecs: row.requiredSpecs }))}
        units={units.map((row) => ({ symbol: row.symbol, name: row.name }))}
      />
    </DeskFormPage>
  );
}

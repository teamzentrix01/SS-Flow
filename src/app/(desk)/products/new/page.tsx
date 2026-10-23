import { ProductCreateForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listDistinctUnits } from "@/modules/masters/product-catalog";

export default async function NewProductPage() {
  await requirePage("plant.manage");
  const units = await listDistinctUnits();
  return (
    <DeskFormPage
      title="Create product"
      detail="Choose Trading or Manufactured, then enter only the specifications relevant to the product."
      backHref="/products?tab=products"
      backLabel="Back to product catalog"
    >
      <ProductCreateForm units={units.map((row) => ({ symbol: row.symbol, name: row.name }))} />
    </DeskFormPage>
  );
}

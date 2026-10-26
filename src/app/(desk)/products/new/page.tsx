import { ProductCreateForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage, plantIdsForSession } from "@/lib/access";
import { listDistinctUnits } from "@/modules/masters/product-catalog";
import { listAllGrades, listAllFinishes } from "@/modules/masters/grades-finishes";

export default async function NewProductPage() {
  const session = await requirePage("plant.manage");
  const plantIds = await plantIdsForSession(session);
  const [units, grades, finishes] = await Promise.all([
    listDistinctUnits(),
    listAllGrades({ plantIds, activeOnly: true }),
    listAllFinishes({ plantIds, activeOnly: true }),
  ]);
  return (
    <DeskFormPage
      title="Create product"
      detail="Choose Trading or Manufactured, then enter only the specifications relevant to the product."
      backHref="/products?tab=products"
      backLabel="Back to product catalog"
    >
      <ProductCreateForm
        units={units.map((row) => ({ symbol: row.symbol, name: row.name }))}
        initialGrades={grades.map((g) => ({ id: g.id, name: g.name }))}
        initialFinishes={finishes.map((f) => ({ id: f.id, name: f.name }))}
      />
    </DeskFormPage>
  );
}

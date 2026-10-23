import { MaterialForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { decorateCategories } from "@/lib/domain/business-categories";
import { getMaterialMaster } from "@/lib/queries";
import { listAllProductCategories } from "@/modules/masters/categories";
import { listDistinctUnits } from "@/modules/masters/product-catalog";
import { notFound } from "next/navigation";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  const [product, categories, units] = await Promise.all([
    getMaterialMaster(id),
    listAllProductCategories(),
    listDistinctUnits(),
  ]);
  if (!product) notFound();
  return (
    <DeskFormPage title="Edit product" backHref={`/products/${id}`} backLabel="Back to product">
      <MaterialForm
        productId={id}
        redirectTo={`/products/${id}`}
        submitLabel="Save changes"
        categories={decorateCategories(categories).map((row) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          parentId: row.parentId,
          requiredSpecs: row.requiredSpecs,
          businessKind: row.businessKind,
          isBusinessRoot: row.isBusinessRoot,
        }))}
        units={units.map((row) => ({ symbol: row.symbol, name: row.name }))}
        initial={{
          name: product.name,
          code: product.code,
          categoryId: product.categoryId ?? "",
          productType: product.productType,
          shape: product.shape,
          description: product.description ?? "",
          grade: product.grade ?? "",
          thickness: product.thickness?.toString() ?? "",
          width: product.width?.toString() ?? "",
          uom: product.uom,
          batchTracking: product.batchTracking,
          status: product.active ? "active" : "inactive",
        }}
      />
    </DeskFormPage>
  );
}

import { notFound } from "next/navigation";
import { ProductCreateForm } from "@/components/master-forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage, plantIdsForSession } from "@/lib/access";
import { inferBusinessKindForProduct } from "@/lib/domain/business-categories";
import { getCatalogProduct, listDistinctUnits } from "@/modules/masters/product-catalog";

export default async function EditCatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  // plantIdsForSession expands to all plants for admins / plant managers.
  const plantIds = await plantIdsForSession(session);
  const [product, units] = await Promise.all([
    getCatalogProduct(id, plantIds),
    listDistinctUnits(),
  ]);
  if (!product || !product.isActive) notFound();
  const kind = inferBusinessKindForProduct({
    sku: product.sku,
    name: product.name,
    productType: product.productType,
    supplyMode: product.supplyMode,
    category: product.category,
  });
  return (
    <DeskFormPage title="Edit product" detail={product.sku} backHref={`/products/catalog/${id}`} backLabel="Back to product">
      <ProductCreateForm
        productId={id}
        units={units.map((row) => ({ symbol: row.symbol, name: row.name }))}
        initial={{
          businessKind: kind,
          name: product.name,
          sku: product.sku,
          specs: (product.variants[0]?.attributes ?? {}) as Record<string, string>,
          baseUnitSymbol: product.baseUnit?.symbol ?? units[0]?.symbol ?? "",
          description: product.description ?? "",
        }}
      />
    </DeskFormPage>
  );
}

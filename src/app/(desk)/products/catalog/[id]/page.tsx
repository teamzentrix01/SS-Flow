import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { BusinessKindBadge } from "@/components/masters/business-kind-badge";
import { requirePage, plantIdsForSession } from "@/lib/access";
import { inferBusinessKindForProduct } from "@/lib/domain/business-categories";
import { getCatalogProduct, listDistinctUnits } from "@/modules/masters/product-catalog";
import { ProductVariantManager } from "@/components/masters/product-variant-manager";

export default async function CatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  // plantIdsForSession expands to all plants for admins / plant managers;
  // using raw session.plantIds would return null for seeded products in other plants.
  const plantIds = await plantIdsForSession(session);
  const [product, units] = await Promise.all([
    getCatalogProduct(id, plantIds),
    listDistinctUnits(),
  ]);
  if (!product) notFound();

  const businessKind = inferBusinessKindForProduct({
    sku: product.sku,
    name: product.name,
    productType: product.productType,
    supplyMode: product.supplyMode,
    category: product.category,
  });

  return (
    <DeskFormPage
      title={product.name}
      detail={`${product.sku} · ${product.supplyMode} · ${product.productType.replaceAll("_", " ")}`}
      backHref="/products?tab=products"
      backLabel="Back to catalog"
    >
      {/* Product actions */}
      <div className="mb-6 flex flex-wrap items-center justify-end gap-2">
        <DeskSecondaryCta href={`/products/catalog/${product.id}/edit`} icon={Pencil}>
          Edit product
        </DeskSecondaryCta>
      </div>

      {/* Parent product info */}
      <dl className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Business category</dt>
          <dd className="mt-1">
            <BusinessKindBadge kind={businessKind} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">SKU / Product code</dt>
          <dd className="mt-1 font-mono text-sm">{product.sku}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Subcategory</dt>
          <dd className="mt-1 text-sm">
            {product.category ? (
              <Link className="text-[var(--accent)] hover:underline" href={`/categories/${product.category.id}`}>
                {product.category.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Base unit</dt>
          <dd className="mt-1 text-sm">{product.baseUnit?.symbol ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Status</dt>
          <dd className="mt-1 text-sm">{product.isActive ? "Active" : "Inactive"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Description</dt>
          <dd className="mt-1 text-sm">{product.description ?? "—"}</dd>
        </div>
      </dl>

      {/* Specifications / Variants */}
      <ProductVariantManager
        productId={product.id}
        units={units.map((unit) => unit.symbol)}
        variants={product.variants.map((variant) => ({
          id: variant.id, sku: variant.sku, displayName: variant.displayName, grade: variant.grade, finish: variant.finish,
          thicknessMm: variant.thicknessMm?.toString() ?? null, widthMm: variant.widthMm?.toString() ?? null,
          lengthMm: variant.lengthMm?.toString() ?? null, diameterMm: variant.diameterMm?.toString() ?? null,
          isActive: variant.isActive, unit: variant.unit ? { symbol: variant.unit.symbol } : null,
          attributes: (variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes) ? variant.attributes : {}) as Record<string, unknown>,
        }))}
      />
    </DeskFormPage>
  );
}

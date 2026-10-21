import Link from "next/link";
import { Layers } from "lucide-react";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { DataTable } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getCatalogProduct } from "@/modules/masters/product-catalog";
import { notFound } from "next/navigation";

export default async function CatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  const product = await getCatalogProduct(id, session.plantIds);
  if (!product) notFound();

  return (
    <DeskFormPage
      title={product.name}
      detail={`${product.sku} · ${product.supplyMode} · ${product.productType.replaceAll("_", " ")}`}
      backHref="/products?tab=products"
      backLabel="Back to catalog"
    >
      <dl className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Category</dt>
          <dd className="mt-1 text-sm">{product.category?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Base unit</dt>
          <dd className="mt-1 text-sm">{product.baseUnit?.symbol ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Description</dt>
          <dd className="mt-1 text-sm">{product.description ?? "—"}</dd>
        </div>
      </dl>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Variants (stock SKUs)</h2>
        <Link href="/products?tab=variants" className="text-sm font-semibold text-accent">
          All SKUs
        </Link>
      </div>
      <DataTable
        columns={[
          { id: "sku", header: "SKU", cell: (row) => row.sku },
          { id: "grade", header: "Grade", cell: (row) => row.grade ?? "—" },
          {
            id: "spec",
            header: "Size",
            cell: (row) =>
              [row.thicknessMm && `${row.thicknessMm} mm`, row.widthMm && `W ${row.widthMm}`]
                .filter(Boolean)
                .join(" · ") || "—",
          },
          { id: "unit", header: "Unit", cell: (row) => row.unit?.symbol ?? "—" },
          {
            id: "stock",
            header: "Inventory link",
            cell: (row) =>
              row.materialMaster ? (
                <Link href={`/products/${row.materialMaster.id}`} className="text-accent hover:underline">
                  {row.materialMaster.code}
                </Link>
              ) : (
                "—"
              ),
          },
          {
            id: "bom",
            header: "",
            cell: (row) =>
              row.materialMaster ? (
                <DeskSecondaryCta href={`/products/${row.materialMaster.id}/bom`} icon={Layers}>
                  Open bill of materials
                </DeskSecondaryCta>
              ) : null,
          },
        ]}
        rows={product.variants}
        getRowKey={(row) => row.id}
        getRowHref={(row) => (row.materialMaster ? `/products/${row.materialMaster.id}` : undefined)}
        emptyTitle="No variants yet"
        emptyDetail="Each product is created with a matching stock SKU. Open the product from the Products tab if a variant is missing."
      />
    </DeskFormPage>
  );
}

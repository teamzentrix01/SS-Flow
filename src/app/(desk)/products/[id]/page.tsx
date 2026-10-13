import Link from "next/link";
import { Layers, Pencil } from "lucide-react";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { getMaterialMaster } from "@/lib/queries";
import { notFound } from "next/navigation";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  const product = await getMaterialMaster(id, session.plantIds);
  if (!product) notFound();
  const showBom = product.category === "utensil" || product.productType === "finished";
  return (
    <DeskFormPage title={product.name} detail={product.code} backHref="/products" backLabel="Back to products">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        {showBom ? (
          <DeskSecondaryCta href={`/products/${id}/bom`} icon={Layers}>
            BOM
          </DeskSecondaryCta>
        ) : null}
        <DeskSecondaryCta href={`/products/${id}/edit`} icon={Pencil}>
          Edit
        </DeskSecondaryCta>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Category</dt>
          <dd className="mt-1 text-sm">
            {product.productCategory ? (
              <Link className="text-[var(--accent)] hover:underline" href={`/categories/${product.productCategory.id}`}>
                {product.productCategory.name}
              </Link>
            ) : (
              product.category
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Product type</dt>
          <dd className="mt-1 text-sm">{product.productType.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Shape / form</dt>
          <dd className="mt-1 text-sm">{product.shape}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Stock UOM</dt>
          <dd className="mt-1 text-sm">{product.uom}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Grade</dt>
          <dd className="mt-1 text-sm">{product.grade ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Status</dt>
          <dd className="mt-1 text-sm">{product.active ? "Active" : "Inactive"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Description</dt>
          <dd className="mt-1 text-sm">{product.description ?? "—"}</dd>
        </div>
      </dl>
    </DeskFormPage>
  );
}

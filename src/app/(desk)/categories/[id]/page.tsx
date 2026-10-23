import Link from "next/link";
import { Pencil } from "lucide-react";
import { DeskFormPage, DeskSecondaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { BusinessKindBadge } from "@/components/masters/business-kind-badge";
import { businessKindFromCategory, isBusinessRootCode } from "@/lib/domain/business-categories";
import { getProductCategory } from "@/modules/masters/categories";
import { MATERIAL_SPEC_FIELDS } from "@/lib/domain/material-specifications";
import { notFound } from "next/navigation";

export default async function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("plant.manage");
  const { id } = await params;
  const category = await getProductCategory(id, session.plantIds);
  if (!category) notFound();
  return (
    <DeskFormPage title={category.name} detail={`Code ${category.code}`} backHref="/products?tab=categories" backLabel="Back to categories">
      <div className="mb-4 flex justify-end">
        <DeskSecondaryCta href={`/categories/${id}/edit`} icon={Pencil}>
          {isBusinessRootCode(category.code) ? "View business category" : "Edit subcategory"}
        </DeskSecondaryCta>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Business category</dt>
          <dd className="mt-1">
            <BusinessKindBadge kind={businessKindFromCategory(category)} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Inventory type</dt>
          <dd className="mt-1 text-sm">{category.categoryType.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Product form</dt>
          <dd className="mt-1 text-sm">{category.productForm ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Required specifications</dt>
          <dd className="mt-1 text-sm">
            {category.requiredSpecs.length
              ? category.requiredSpecs
                  .map((key) => MATERIAL_SPEC_FIELDS.find((field) => field.key === key)?.label ?? key)
                  .join(", ")
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Parent</dt>
          <dd className="mt-1 text-sm">
            {category.parent ? (
              <Link className="text-[var(--accent)] hover:underline" href={`/categories/${category.parent.id}`}>
                {category.parent.name}
              </Link>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Status</dt>
          <dd className="mt-1 text-sm capitalize">{category.status}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Description</dt>
          <dd className="mt-1 text-sm">{category.description ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">Products</dt>
          <dd className="mt-1 text-sm">{category._count.products}</dd>
        </div>
      </dl>
    </DeskFormPage>
  );
}

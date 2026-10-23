import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CategoryRowActions } from "@/components/masters/category-row-actions";
import { BusinessKindBadge } from "@/components/masters/business-kind-badge";
import { ProductCatalogFilters } from "@/components/masters/product-catalog-filters";
import { ProductCatalogTabs, type ProductCatalogTab } from "@/components/masters/product-catalog-tabs";
import { ProductRowActions } from "@/components/masters/product-row-actions";
import { CatalogProductRowActions } from "@/components/masters/catalog-product-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import {
  businessKindFromCategory,
  decorateCategories,
  inferBusinessKindForProduct,
  isBusinessRootCode,
  type BusinessKind,
} from "@/lib/domain/business-categories";
import { listAllProductsForDesk } from "@/lib/queries";
import { listAllProductCategories } from "@/modules/masters/categories";
import { listAllCatalogProducts, listAllUnits } from "@/modules/masters/product-catalog";

function matchesQuery(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q.toLowerCase());
}

export default async function ProductsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; business?: string }>;
}) {
  const session = await requirePage("plant.manage");
  const { tab: tabRaw, q = "", business: businessRaw } = await searchParams;
  const tab = (["products", "variants", "categories", "units"].includes(tabRaw ?? "")
    ? tabRaw
    : "products") as ProductCatalogTab;
  const business = (["trading", "manufactured"].includes(businessRaw ?? "") ? businessRaw : "") as
    | BusinessKind
    | "";
  const query = q.trim();

  const [catalogProducts, variants, categories, units] = await Promise.all([
    listAllCatalogProducts({ q: query || undefined }),
    listAllProductsForDesk(),
    listAllProductCategories({ activeOnly: false }),
    listAllUnits(),
  ]);
  const decoratedCategories = decorateCategories(categories);

  const filteredCatalog = catalogProducts.filter((row) => {
    const kind = inferBusinessKindForProduct({
      sku: row.sku,
      name: row.name,
      productType: row.productType,
      supplyMode: row.supplyMode,
      category: row.category,
    });
    if (business && kind !== business) return false;
    return true;
  });

  const filteredVariants = variants.filter((row) => {
    const kind = businessKindFromCategory(row.productCategory) ?? inferBusinessKindForProduct({
      sku: row.productVariant?.product?.sku ?? row.code,
      name: row.name,
      productType: row.productType,
      supplyMode: row.productVariant?.product?.supplyMode ?? (row.purchaseAllowed && !row.manufacturingAllowed ? "purchased" : "manufactured"),
      category: row.productCategory,
    });
    if (business && kind !== business) return false;
    if (query) {
      return [row.code, row.name, row.productCategory?.name ?? "", row.productVariant?.product?.name ?? ""].some((value) =>
        matchesQuery(value, query),
      );
    }
    return true;
  });

  const filteredCategories = decoratedCategories.filter((row) => {
    if (business && row.businessKind !== business) return false;
    if (query) return [row.code, row.name].some((value) => matchesQuery(value, query));
    return true;
  });

  const title =
    tab === "categories"
      ? "Product catalog · Categories"
      : tab === "units"
        ? "Product catalog · Units"
        : tab === "variants"
          ? "Product catalog · Stock SKUs"
          : "Product catalog";

  const detail =
    "Every product sits under Trading Products or Manufactured Products. Subcategories (coil, sheet, utensils, and so on) stay under those two lines.";

  return (
    <DeskListShell
      title={title}
      detail={detail}
      action={
        tab === "products" ? (
          <DeskPrimaryCta href="/products/new" icon={Plus}>
            Create product
          </DeskPrimaryCta>
        ) : tab === "categories" ? (
          <DeskPrimaryCta href="/categories/new" icon={Plus}>
            Create subcategory
          </DeskPrimaryCta>
        ) : null
      }
    >
      <ProductCatalogTabs active={tab} q={query || undefined} business={business || undefined} />
      {tab !== "units" ? (
        <Suspense>
          <ProductCatalogFilters tab={tab} />
        </Suspense>
      ) : null}

      {tab === "products" ? (
        <DataTable
          columns={[
            { id: "sku", header: "SKU", cell: (row) => row.sku },
            { id: "name", header: "Product", cell: (row) => row.name },
            {
              id: "business",
              header: "Category",
              cell: (row) => (
                <BusinessKindBadge
                  kind={inferBusinessKindForProduct({
                    sku: row.sku,
                    name: row.name,
                    productType: row.productType,
                    supplyMode: row.supplyMode,
                    category: row.category,
                  })}
                />
              ),
            },
            { id: "grade", header: "Grade", cell: (row) => row.variants[0]?.grade ?? "—" },
            { id: "finish", header: "Finish", cell: (row) => row.variants[0]?.finish ?? "—" },
            { id: "width", header: "Width", cell: (row) => row.variants[0]?.widthMm?.toString() ?? "—" },
            { id: "length", header: "Length", cell: (row) => row.variants[0]?.lengthMm?.toString() ?? "—" },
            { id: "unit", header: "Base unit", cell: (row) => row.baseUnit?.symbol ?? "—" },
            {
              id: "actions",
              header: "Action",
              headerClassName: "w-[120px] text-right",
              cellClassName: "text-right",
              stopRowClick: true,
              cell: (row) => <CatalogProductRowActions id={row.id} />,
            },
          ]}
          rows={filteredCatalog}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/products/catalog/${row.id}`}
          emptyTitle={query || business ? "No products match these filters" : "No product families yet"}
          emptyDetail={
            query || business
              ? "Clear filters to see the full catalog."
              : "Create a product under Trading Products or Manufactured Products."
          }
        />
      ) : null}

      {tab === "variants" ? (
        <DataTable
          columns={[
            { id: "code", header: "SKU / code", cell: (row) => row.code },
            { id: "name", header: "Name", cell: (row) => row.name },
            {
              id: "business",
              header: "Business",
              cell: (row) => <BusinessKindBadge kind={businessKindFromCategory(row.productCategory)} />,
            },
            {
              id: "family",
              header: "Product family",
              cell: (row) => row.productVariant?.product?.name ?? "—",
            },
            {
              id: "category",
              header: "Subcategory",
              cell: (row) => row.productCategory?.name ?? row.category,
            },
            { id: "type", header: "Type", cell: (row) => row.productType.replaceAll("_", " ") },
            { id: "uom", header: "UOM", cell: (row) => row.uom },
            { id: "grade", header: "Grade", cell: (row) => row.grade ?? "—" },
            {
              id: "actions",
              header: "Action",
              headerClassName: "w-[120px] text-right",
              cellClassName: "text-right",
              stopRowClick: true,
              cell: (row) => (
                <ProductRowActions
                  id={row.id}
                  showBom={row.productType === "finished" || row.category === "utensil"}
                />
              ),
            },
          ]}
          rows={filteredVariants}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/products/${row.id}`}
          emptyTitle={query || business ? "No stock SKUs match these filters" : "No stock SKUs"}
          emptyDetail="Stock SKUs are created with products. Use Create product on the Products tab."
        />
      ) : null}

      {tab === "categories" ? (
        <DataTable
          columns={[
            { id: "code", header: "Code", cell: (row) => row.code },
            { id: "name", header: "Name", cell: (row) => row.name },
            {
              id: "business",
              header: "Business",
              cell: (row) => <BusinessKindBadge kind={row.businessKind} />,
            },
            { id: "type", header: "Inventory type", cell: (row) => row.categoryType.replaceAll("_", " ") },
            { id: "form", header: "Form", cell: (row) => row.productForm ?? "—" },
            {
              id: "parent",
              header: "Parent",
              cell: (row) => (isBusinessRootCode(row.code) ? "—" : row.parent?.name ?? "—"),
            },
            { id: "status", header: "Status", cell: (row) => row.status },
            {
              id: "actions",
              header: "Action",
              headerClassName: "w-[120px] text-right",
              cellClassName: "text-right",
              stopRowClick: true,
              cell: (row) =>
                isBusinessRootCode(row.code) ? (
                  <span className="text-xs text-muted">Locked</span>
                ) : (
                  <CategoryRowActions
                    id={row.id}
                    canDelete={row._count.products === 0 && row._count.children === 0 && row._count.catalogProducts === 0}
                  />
                ),
            },
          ]}
          rows={filteredCategories}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/categories/${row.id}`}
          emptyTitle={query || business ? "No categories match these filters" : "No categories yet"}
          emptyDetail="Trading Products and Manufactured Products are the only top-level lines. Add subcategories under them."
        />
      ) : null}

      {tab === "units" ? (
        <DataTable
          columns={[
            { id: "symbol", header: "Symbol", cell: (row) => row.symbol },
            { id: "name", header: "Name", cell: (row) => row.name },
            { id: "type", header: "Type", cell: (row) => row.unitType },
          ]}
          rows={units}
          getRowKey={(row) => row.id}
          emptyTitle="No units"
          emptyDetail="Units are seeded (KG, T, PCS, M). Used on products, orders, and BOM lines."
        />
      ) : null}
    </DeskListShell>
  );
}

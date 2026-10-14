import { Plus } from "lucide-react";
import Link from "next/link";
import { CategoryRowActions } from "@/components/masters/category-row-actions";
import { ProductCatalogTabs, type ProductCatalogTab } from "@/components/masters/product-catalog-tabs";
import { ProductRowActions } from "@/components/masters/product-row-actions";
import { DataTable, DeskListShell, DeskPrimaryCta } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { listProductsForDesk } from "@/lib/queries";
import { listProductCategories } from "@/modules/masters/categories";
import { listCatalogProducts, listUnits } from "@/modules/masters/product-catalog";

export default async function ProductsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requirePage("plant.manage");
  const { tab: tabRaw } = await searchParams;
  const tab = (["products", "variants", "categories", "units"].includes(tabRaw ?? "")
    ? tabRaw
    : "products") as ProductCatalogTab;

  const [catalogProducts, variants, categories, units] = await Promise.all([
    listCatalogProducts(session.plantIds),
    listProductsForDesk(session.plantIds),
    listProductCategories(session.plantIds, { activeOnly: false }),
    listUnits(session.plantIds),
  ]);

  const title =
    tab === "categories"
      ? "Product catalog · Categories"
      : tab === "units"
        ? "Product catalog · Units"
        : tab === "variants"
          ? "Product catalog · Stock SKUs"
          : "Product catalog";

  const detail =
    "Categories, units, product families, and variants live in one place. Pick related records from dropdowns on order and BOM screens—no extra sidebar clutter.";

  return (
    <DeskListShell
      title={title}
      detail={detail}
      action={
        tab === "products" ? (
          <DeskPrimaryCta href="/products/new" icon={Plus}>
            New stock SKU
          </DeskPrimaryCta>
        ) : tab === "categories" ? (
          <DeskPrimaryCta href="/categories/new" icon={Plus}>
            New category
          </DeskPrimaryCta>
        ) : null
      }
    >
      <ProductCatalogTabs active={tab} />

      {tab === "products" ? (
        <DataTable
          columns={[
            { id: "sku", header: "SKU", cell: (row) => row.sku },
            { id: "name", header: "Product family", cell: (row) => row.name },
            { id: "category", header: "Category", cell: (row) => row.category?.name ?? "—" },
            { id: "type", header: "Type", cell: (row) => row.productType.replaceAll("_", " ") },
            { id: "supply", header: "Supply", cell: (row) => row.supplyMode },
            { id: "unit", header: "Base unit", cell: (row) => row.baseUnit?.symbol ?? "—" },
            { id: "variants", header: "Variants", cell: (row) => row._count.variants },
            {
              id: "link",
              header: "",
              cell: (row) => (
                <Link href={`/products/catalog/${row.id}`} className="text-sm font-semibold text-accent">
                  Open
                </Link>
              ),
            },
          ]}
          rows={catalogProducts}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/products/catalog/${row.id}`}
          emptyTitle="No product families yet"
          emptyDetail="Run db seed or add categories and products from the admin catalog."
        />
      ) : null}

      {tab === "variants" ? (
        <DataTable
          columns={[
            { id: "code", header: "SKU / code", cell: (row) => row.code },
            { id: "name", header: "Name", cell: (row) => row.name },
            {
              id: "family",
              header: "Product family",
              cell: (row) => row.productVariant?.product?.name ?? "—",
            },
            {
              id: "category",
              header: "Category",
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
          rows={variants}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/products/${row.id}`}
          emptyTitle="No stock SKUs"
          emptyDetail="Variants link to inventory batches. Create a SKU under Products → New stock SKU."
        />
      ) : null}

      {tab === "categories" ? (
        <DataTable
          columns={[
            { id: "code", header: "Code", cell: (row) => row.code },
            { id: "name", header: "Name", cell: (row) => row.name },
            { id: "type", header: "Type", cell: (row) => row.categoryType.replaceAll("_", " ") },
            { id: "form", header: "Form", cell: (row) => row.productForm ?? "—" },
            { id: "parent", header: "Parent", cell: (row) => row.parent?.name ?? "—" },
            { id: "status", header: "Status", cell: (row) => row.status },
            {
              id: "actions",
              header: "Action",
              headerClassName: "w-[120px] text-right",
              cellClassName: "text-right",
              stopRowClick: true,
              cell: (row) => (
                <CategoryRowActions
                  id={row.id}
                  canDelete={row._count.products === 0 && row._count.children === 0}
                />
              ),
            },
          ]}
          rows={categories}
          getRowKey={(row) => row.id}
          getRowHref={(row) => `/categories/${row.id}`}
          emptyTitle="No categories yet"
          emptyDetail="Create Steel Stock, Semi-Finished, and Finished Goods groupings."
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

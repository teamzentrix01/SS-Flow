import Link from "next/link";

const tabs = [
  { id: "products", label: "Products" },
  { id: "categories", label: "Categories" },
  { id: "grades", label: "Grades" },
  { id: "finishes", label: "Finishes" },
  { id: "units", label: "Units" },
] as const;

export type ProductCatalogTab = (typeof tabs)[number]["id"];

export function ProductCatalogTabs({
  active,
  q,
  business,
}: {
  active: ProductCatalogTab;
  q?: string;
  business?: string;
}) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {tabs.map((tab) => {
        const href = new URLSearchParams();
        href.set("tab", tab.id);
        if (q) href.set("q", q);
        if (business) href.set("business", business);
        return (
          <Link
            key={tab.id}
            href={`/products?${href.toString()}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              active === tab.id
                ? "bg-[var(--accent-soft)] text-[var(--brand)]"
                : "text-muted hover:bg-muted/30 hover:text-[var(--ink)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

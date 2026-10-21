"use client";

import Link from "next/link";

const tabs = [
  { id: "products", label: "Products" },
  { id: "variants", label: "Stock SKUs (linked)" },
  { id: "categories", label: "Categories" },
  { id: "units", label: "Units" },
] as const;

export type ProductCatalogTab = (typeof tabs)[number]["id"];

export function ProductCatalogTabs({ active }: { active: ProductCatalogTab }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/products?tab=${tab.id}`}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
            active === tab.id
              ? "bg-[var(--accent-soft)] text-[var(--brand)]"
              : "text-muted hover:bg-muted/30 hover:text-[var(--ink)]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

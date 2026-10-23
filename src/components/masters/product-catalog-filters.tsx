"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { controlClass } from "@/components/ui";
import { BUSINESS_KIND, BUSINESS_ROOTS } from "@/lib/domain/business-categories";

export function ProductCatalogFilters({ tab }: { tab: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/products?${next.toString()}`);
  }

  const hrefFor = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", tab);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    return `/products?${next.toString()}`;
  };

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium">Search</span>
        <input
          className={controlClass}
          defaultValue={params.get("q") ?? ""}
          placeholder="SKU, name, or category"
          onBlur={(event) => update("q", event.target.value.trim())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              update("q", event.currentTarget.value.trim());
            }
          }}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Business category</span>
        <select
          className={controlClass}
          value={params.get("business") ?? ""}
          onChange={(event) => update("business", event.target.value)}
        >
          <option value="">All</option>
          <option value={BUSINESS_KIND.trading}>{BUSINESS_ROOTS.trading.name}</option>
          <option value={BUSINESS_KIND.manufactured}>{BUSINESS_ROOTS.manufactured.name}</option>
        </select>
      </label>
      <div className="flex items-end md:col-span-3">
        <Link href={hrefFor({ q: null, business: null })} className="text-sm font-medium text-accent hover:underline">
          Clear filters
        </Link>
      </div>
    </div>
  );
}

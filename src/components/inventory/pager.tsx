"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function InventoryPager({
  action,
  page,
  pageSize,
  total,
}: {
  action: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  function href(nextPage: number, nextSize = pageSize) {
    const search = new URLSearchParams(params.toString());
    search.set("page", String(nextPage));
    search.set("pageSize", String(nextSize));
    return `${action}?${search.toString()}`;
  }
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">Rows</span>
        {[25, 50, 100].map((size) => (
          <Link
            key={size}
            href={href(1, size)}
            className={`rounded-lg px-2 py-1 ${pageSize === size ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-foreground"}`}
          >
            {size}
          </Link>
        ))}
        <Link
          href={href(Math.max(1, page - 1))}
          className={`rounded-lg border border-border px-3 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:border-accent"}`}
        >
          Previous
        </Link>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Link
          href={href(Math.min(pages, page + 1))}
          className={`rounded-lg border border-border px-3 py-1 ${page >= pages ? "pointer-events-none opacity-40" : "hover:border-accent"}`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { NotificationBell, type BellNote } from "@/components/notification-bell";

const crumbs: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  ledger: "Movements",
  transfer: "Transfer",
  adjust: "Adjust",
  batches: "Batch",
  sales: "Sales",
  masters: "Masters",
  products: "Products",
  bom: "BOM",
  purchasing: "Purchasing",
  suppliers: "Suppliers",
  orders: "Orders",
  receipts: "Receipts",
  requisitions: "Requisitions",
  new: "New",
  production: "Production",
  jobs: "Jobs",
  machines: "Machines",
  dies: "Dies",
  quality: "Quality",
  people: "Workforce",
  employees: "Employees",
  dispatch: "Dispatch",
  maintenance: "Maintenance",
  reports: "Reports",
  notifications: "Notifications",
  settings: "Settings",
  "material-requests": "Material requests",
};

export function DeskTopbar({
  items,
  notes,
  unread,
  onOpenMenu,
}: {
  items: { href: string; label: string; group: string }[];
  notes: BellNote[];
  unread: number;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const trail = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => crumbs[part] ?? part);
  const pageTitle = trail[trail.length - 1] ?? "Desk";
  const matches = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:px-8">
      <button
        type="button"
        className="grid size-10 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg)] lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" strokeWidth={1.7} />
      </button>
      <p className="min-w-0 truncate text-[13px] text-[var(--ink-muted)]">
        {trail.length > 1 ? `${trail.slice(0, -1).join(" / ")} / ` : ""}
        <span className="text-[var(--ink)]">{pageTitle}</span>
      </p>
      <div className="relative ml-auto hidden w-[300px] md:block">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-[18px] text-[var(--ink-muted)]" strokeWidth={1.7} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a page"
          aria-label="Find a page"
          className="h-10 w-full rounded-lg border border-transparent bg-[var(--bg)] pr-3 pl-10 text-sm text-[var(--ink)] outline-none transition focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2"
        />
        {query.trim() ? (
          <div className="absolute top-12 right-0 left-0 z-10 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md">
            {matches.length ? (
              matches.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setQuery("")}
                  className="block px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--bg)]"
                >
                  {item.group} · {item.label}
                </Link>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-[var(--ink-muted)]">No matching page</p>
            )}
          </div>
        ) : null}
      </div>
      <NotificationBell notes={notes} unread={unread} variant="desk" />
    </header>
  );
}

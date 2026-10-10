"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { NotificationBell, type BellNote } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const crumbs: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  ledger: "Movements",
  transfer: "Transfer",
  adjust: "Adjust",
  batches: "Batch",
  purchasing: "Purchasing",
  suppliers: "Suppliers",
  orders: "Orders",
  receipts: "Receipts",
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
};

export function DeskShell({
  name,
  email,
  plantName,
  unread,
  notes,
  items,
  showShop,
  children,
}: {
  name: string;
  email: string;
  plantName: string;
  unread: number;
  notes: BellNote[];
  items: { href: string; label: string; group: string }[];
  showShop: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SF";

  const groups = useMemo(() => {
    const ordered: { name: string; items: typeof items }[] = [];
    for (const item of items) {
      const group = ordered.find((entry) => entry.name === item.group);
      if (group) group.items.push(item);
      else ordered.push({ name: item.group, items: [item] });
    }
    return ordered;
  }, [items]);

  const matches = query.trim()
    ? items.filter((item) =>
        item.label.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : [];

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(false);
        setQuery("");
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function active(href: string) {
    const hit = pathname === href || pathname.startsWith(`${href}/`);
    if (!hit) return false;
    return !items.some(
      (item) =>
        item.href !== href &&
        item.href.startsWith(`${href}/`) &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    );
  }

  const trail = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => crumbs[part] ?? part);
  const navigation = (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
      {groups.map((group) => {
        const shut = closedGroups.includes(group.name);
        return (
          <div key={group.name}>
            <button
              type="button"
              className="mb-1 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8aaa4]"
              onClick={() =>
                setClosedGroups((current) =>
                  current.includes(group.name)
                    ? current.filter((name) => name !== group.name)
                    : [...current, group.name],
                )
              }
            >
              {group.name}
              <ChevronDown
                className={`size-3.5 transition ${shut ? "-rotate-90" : ""}`}
              />
            </button>
            {shut ? null : (
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    onClick={() => setOpen(false)}
                    className={`flex items-center rounded-[10px] px-3 py-2 text-sm transition ${active(item.href) ? "bg-lime font-semibold text-graphite" : "text-[#efece4] hover:bg-white/10"}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy text-[#efece4] md:flex">
        <div className="flex items-center justify-between px-4 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">SteelFlow</p>
            <p className="mt-1 text-sm font-semibold">SS-Steel-Flow</p>
          </div>
        </div>
        <p className="mx-4 mb-2 truncate rounded-[10px] bg-white/10 px-3 py-2 text-xs text-[#efece4]">{plantName}</p>
        {navigation}
      </aside>
      {open ? (
        <div className="fixed inset-0 z-40 bg-navy text-[#efece4] md:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <p className="font-semibold">SS-Steel-Flow</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>
          <p className="px-4 pb-2 text-xs text-[#a8aaa4]">{plantName}</p>
          {navigation}
        </div>
      ) : null}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur">
          <button
            type="button"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <p className="hidden min-w-0 truncate text-sm text-muted lg:block">
            {trail.join(" / ") || "Desk"}
          </p>
          <div className="relative ml-auto hidden w-56 md:block">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a page"
              aria-label="Find a page"
              className="h-10 w-full rounded-[10px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-foreground"
            />
            {query.trim() ? (
              <div className="absolute top-12 right-0 left-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {matches.length ? (
                  matches.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setQuery("")}
                      className="block px-3 py-2 text-sm hover:bg-surface-muted"
                    >
                      {item.group} · {item.label}
                    </Link>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-muted">
                    No matching page
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <span className="hidden items-center gap-2 text-xs text-muted xl:inline-flex">
            <span className="size-2 rounded-full bg-lime" />
            Session active
          </span>
          <NotificationBell notes={notes} unread={unread} />
          {showShop ? (
            <Link
              href="/shop"
              className="hidden text-sm font-semibold text-steel sm:inline"
            >
              Shop floor
            </Link>
          ) : null}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full bg-lime text-sm font-bold text-graphite"
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu((value) => !value)}
            >
              {initials}
            </button>
            {menu ? (
              <div
                role="menu"
                className="absolute top-12 right-0 w-64 rounded-2xl border border-border bg-card p-3 shadow-sm"
              >
                <p className="font-semibold">{name}</p>
                <p className="truncate text-sm text-muted">{email}</p>
                <p className="mt-1 text-xs text-muted">{plantName}</p>
                <div className="mt-3">
                  <ThemeToggle />
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="mt-3 w-full rounded-[10px] border border-border px-3 py-2 text-left text-sm font-medium"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

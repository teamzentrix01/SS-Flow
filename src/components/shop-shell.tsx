"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/shop", label: "Home" },
  { href: "/shop/jobs", label: "My jobs" },
  { href: "/shop/requests", label: "Material" },
  { href: "/shop/history", label: "Activity" },
  { href: "/shop/alerts", label: "Alerts" },
];

export function ShopShell({
  name,
  shift,
  children,
  qc = false,
}: {
  name: string;
  shift?: string | null;
  children: React.ReactNode;
  qc?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = qc
    ? [
        { href: "/shop/qc", label: "Queue" },
        { href: "/shop/alerts", label: "Alerts" },
      ]
    : links;
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SF";

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-accent text-sm font-bold text-[var(--on-accent)]">
              {initials}
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Shop floor
              </p>
              <p className="font-semibold">{name}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <p>{shift ?? "Shift"}</p>
            <button
              type="button"
              className="text-muted transition hover:text-accent"
              onClick={async () => {
                await fetch("/api/v1/auth/logout", { method: "POST" });
                router.push("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 grid border-t border-border bg-card"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/shop" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-16 items-center justify-center text-sm font-semibold transition ${active ? "text-accent" : "text-muted hover:text-accent"}`}
            >
              <span
                className={
                  active ? "rounded-full bg-accent-soft px-3 py-1 text-accent" : ""
                }
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

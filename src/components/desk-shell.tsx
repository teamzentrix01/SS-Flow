"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { DeskSidebar } from "@/components/desk-sidebar";
import { DeskTopbar } from "@/components/desk-topbar";
import type { BellNote } from "@/components/notification-bell";
import { NAV_ICONS, SHOP_SIDEBAR_BLOCKS, SIDEBAR_BLOCKS, type SidebarBlock } from "@/lib/desk-nav-ui";

export function DeskShell({
  greetingLabel,
  dateLabel,
  userName,
  plantName,
  shiftLabel,
  unread,
  notes,
  items,
  sidebarBlocks,
  children,
}: {
  greetingLabel: string;
  dateLabel: string;
  userName: string;
  email: string;
  plantName: string;
  shiftLabel: string;
  unread: number;
  notes: BellNote[];
  items: { href: string; label: string; group: string }[];
  sidebarBlocks?: SidebarBlock[];
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, [pathname]);
  const shopMode = items.some((item) => item.href.startsWith("/shop"));
  const phoneTabHrefs = shopMode
    ? ["/shop", "/shop/jobs", "/shop/requests"]
    : ["/dashboard", "/inventory", "/jobs"];
  const phoneTabs = phoneTabHrefs
    .map((href) => items.find((item) => item.href === href))
    .filter((item) => item !== undefined);

  function tabActive(href: string) {
    if (href === "/shop") return pathname === "/shop";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <div className="flex min-h-screen">
        <DeskSidebar
          items={items}
          blocks={sidebarBlocks ?? (shopMode ? SHOP_SIDEBAR_BLOCKS : SIDEBAR_BLOCKS)}
          plantName={plantName}
          shiftLabel={shiftLabel}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <DeskTopbar
            items={items}
            notes={notes}
            unread={unread}
            greetingLabel={greetingLabel}
            dateLabel={dateLabel}
            userName={userName}
            onOpenMenu={() => setMobileOpen(true)}
          />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-10 lg:pb-10">{children}</main>
        </div>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--border)] bg-[var(--surface)] lg:hidden"
        style={{ gridTemplateColumns: `repeat(${phoneTabs.length + 1}, minmax(0, 1fr))` }}
      >
        {phoneTabs.map((item) => {
          const Icon = NAV_ICONS[item.href] ?? Menu;
          const on = tabActive(item.href);
          const label =
            item.href === "/dashboard" || item.href === "/shop"
              ? "Home"
              : item.href === "/jobs" || item.href === "/shop/jobs"
                ? "Jobs"
                : item.href === "/shop/requests"
                  ? "Material"
                  : item.href === "/shop/alerts"
                    ? "Alerts"
                    : "Stock";
          return (
            <Link key={item.href} href={item.href} className={`cursor-pointer flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${on ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"}`}>
              <Icon className="size-4" strokeWidth={1.7} />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setMobileOpen(true)} className="cursor-pointer flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-[var(--ink-muted)]">
          <Menu className="size-4" strokeWidth={1.7} />
          More
        </button>
      </nav>
    </div>
  );
}

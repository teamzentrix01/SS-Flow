"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Factory, X } from "lucide-react";
import {
  NAV_ICONS,
  SIDEBAR_SECTIONS,
  itemByHref,
  type DeskNavItem,
} from "@/lib/desk-nav-ui";

function groupOpenByPath(pathname: string, groupId: string, hrefs: string[]) {
  if (groupId === "inventory") {
    return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith("/inventory"));
  }
  if (groupId === "purchasing") {
    return hrefs.some((href) => pathname === href || pathname.startsWith("/purchasing"));
  }
  return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function DeskSidebar({
  items,
  plantName,
  shiftLabel,
  mobileOpen,
  onMobileClose,
  onNavigate,
}: {
  items: DeskNavItem[];
  plantName: string;
  shiftLabel: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const [groupToggles, setGroupToggles] = useState<
    Record<string, { path: string; open: boolean }>
  >({});

  function isGroupOpen(groupId: string, hrefs: string[]) {
    const forced = groupToggles[groupId];
    if (forced?.path === pathname) return forced.open;
    return groupOpenByPath(pathname, groupId, hrefs);
  }

  function toggleGroup(groupId: string, hrefs: string[]) {
    const open = isGroupOpen(groupId, hrefs);
    setGroupToggles((prev) => ({
      ...prev,
      [groupId]: { path: pathname, open: !open },
    }));
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const root = mobileDrawerRef.current;
    const focusables = root
      ? Array.from(
          root.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      : [];
    focusables[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onMobileClose();
        return;
      }
      if (event.key !== "Tab" || !root || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onMobileClose]);

  function isActive(href: string) {
    const hit = pathname === href || pathname.startsWith(`${href}/`);
    if (!hit) return false;
    return !items.some(
      (item) =>
        item.href !== href &&
        item.href.startsWith(`${href}/`) &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    );
  }

  function renderLink(href: string, label: string, nested = false) {
    const Icon = NAV_ICONS[href] ?? Factory;
    const active = isActive(href);
    const base = nested
      ? "relative ml-3 flex h-[34px] items-center gap-2 rounded-lg pl-4 pr-2 text-[13.5px] font-medium before:absolute before:top-0 before:bottom-0 before:left-0 before:w-px before:bg-[var(--sb-border)]"
      : "flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-medium";
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          onNavigate?.();
          onMobileClose();
        }}
        className={`${base} transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          active
            ? "bg-[var(--sb-active)] text-[var(--sb-text-strong)] shadow-[inset_3px_0_0_var(--accent)]"
            : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
        }`}
      >
        {!nested ? (
          <Icon
            className={`size-[18px] shrink-0 ${active ? "text-[var(--accent)]" : ""}`}
            strokeWidth={1.7}
          />
        ) : null}
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  type NavBlockEntry =
    | { kind: "link"; item: DeskNavItem }
    | {
        kind: "group";
        block: { type: "group"; id: string; label: string; hrefs: string[] };
        groupItems: DeskNavItem[];
      };

  const navBody = SIDEBAR_SECTIONS.map((section) => {
    const blocks: NavBlockEntry[] = [];
    for (const block of section.blocks) {
      if (block.type === "link") {
        const item = itemByHref(items, block.href);
        if (item) blocks.push({ kind: "link", item });
        continue;
      }
      const groupItems = block.hrefs
        .map((href) => itemByHref(items, href))
        .filter((item): item is DeskNavItem => Boolean(item));
      if (groupItems.length) blocks.push({ kind: "group", block, groupItems });
    }
    if (!blocks.length) return null;
    return (
      <div key={section.label} className="mb-1">
        <p className="mx-2.5 mb-1.5 mt-[18px] font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--sb-label)] first:mt-0">
          {section.label}
        </p>
        <div className="space-y-0.5">
          {blocks.map((entry) => {
            if (entry.kind === "link") {
              return renderLink(entry.item.href, entry.item.label);
            }
            const open = isGroupOpen(entry.block.id, entry.block.hrefs);
            const GroupIcon = NAV_ICONS[entry.groupItems[0]!.href] ?? Factory;
            const groupActive = entry.groupItems.some((item) => isActive(item.href));
            return (
              <div key={entry.block.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleGroup(entry.block.id, entry.block.hrefs)}
                  className={`flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    groupActive
                      ? "bg-[var(--sb-active)] text-[var(--sb-text-strong)]"
                      : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
                  }`}
                >
                  <GroupIcon
                    className={`size-[18px] shrink-0 ${groupActive ? "text-[var(--accent)]" : ""}`}
                    strokeWidth={1.7}
                  />
                  <span className="flex-1 truncate text-left">{entry.block.label}</span>
                  <ChevronDown
                    className={`size-3.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
                  />
                </button>
                {open ? (
                  <div className="mt-0.5 space-y-0.5 overflow-hidden transition-all duration-200">
                    {entry.groupItems.map((item) => renderLink(item.href, item.label, true))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  });

  const aside = (
    <aside className="sidebar-scroll flex h-full w-[272px] shrink-0 flex-col border-r border-[var(--sb-border)] bg-[var(--sb-bg)] px-3.5 py-5 text-[var(--sb-text)]">
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--accent)]">
          <Factory className="size-[18px] text-[var(--on-accent)]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[var(--sb-text-strong)]">SteelFlow</p>
          <p className="text-xs text-[var(--sb-label)]">Production suite</p>
        </div>
        <button
          type="button"
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-lg text-[var(--sb-text)] hover:bg-[var(--sb-hover)] lg:hidden"
          onClick={onMobileClose}
          aria-label="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="mb-4 flex h-12 items-center gap-3 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-hover)] px-3">
        <span className="size-2 shrink-0 rounded-full bg-[var(--ok)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--sb-text-strong)]">{plantName}</span>
          <span className="block truncate text-[11.5px] text-[var(--sb-label)]">{shiftLabel}</span>
        </span>
      </div>

      <nav className="sidebar-scroll flex flex-1 flex-col overflow-y-auto pb-4">{navBody}</nav>
    </aside>
  );

  return (
    <>
      <div className="sticky top-0 hidden h-screen shrink-0 lg:flex">{aside}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu overlay"
            onClick={onMobileClose}
          />
          <div
            ref={mobileDrawerRef}
            className="relative flex h-full max-w-[272px] flex-col shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {aside}
          </div>
        </div>
      ) : null}
    </>
  );
}


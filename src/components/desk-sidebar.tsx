"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Factory, X } from "lucide-react";
import {
  NAV_ICONS,
  SIDEBAR_GROUP_ICONS,
  SIDEBAR_BLOCKS,
  itemByHref,
  type DeskNavItem,
  type SidebarBlock,
} from "@/lib/desk-nav-ui";

const SIDEBAR_WIDTH = 260;

function groupOpenByPath(pathname: string, groupId: string, hrefs: string[]) {
  if (groupId === "jobs") {
    return (
      pathname === "/jobs" ||
      pathname.startsWith("/jobs/") ||
      pathname === "/job-approvals" ||
      pathname.startsWith("/job-approvals/")
    );
  }
  if (groupId === "production") {
    return (
      pathname.startsWith("/production") ||
      pathname.startsWith("/dispatch") ||
      pathname.startsWith("/inventory") ||
      pathname.startsWith("/material-requests")
    );
  }
  if (groupId === "quality") {
    return pathname.startsWith("/quality") || pathname.startsWith("/maintenance");
  }
  return hrefs.some((href) => pathname === href || pathname.startsWith(`${href}/`));
}

export function DeskSidebar({
  items,
  blocks = SIDEBAR_BLOCKS,
  mobileOpen,
  onMobileClose,
  onNavigate,
}: {
  items: DeskNavItem[];
  blocks?: SidebarBlock[];
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
    const hit =
      href === "/shop"
        ? pathname === "/shop"
        : pathname === href || pathname.startsWith(`${href}/`);
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
    if (nested) {
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          onClick={() => {
            onNavigate?.();
            onMobileClose();
          }}
          className={`flex h-9 items-center rounded-lg pl-9 pr-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            active
              ? "bg-[var(--accent-soft)] font-semibold text-[var(--brand)]"
              : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
          }`}
        >
          <span className="truncate">{label}</span>
        </Link>
      );
    }
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          onNavigate?.();
          onMobileClose();
        }}
        className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
          active
            ? "bg-[var(--accent)] font-semibold text-[var(--on-accent)]"
            : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
        }`}
      >
        <Icon
          className={`size-[18px] shrink-0 ${active ? "text-[var(--on-accent)]" : ""}`}
          strokeWidth={1.75}
          aria-hidden
        />
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

  const entries: NavBlockEntry[] = [];
  for (const block of blocks) {
    if (block.type === "link") {
      const item = itemByHref(items, block.href);
      if (item) entries.push({ kind: "link", item });
      continue;
    }
    const groupItems = block.hrefs
      .map((href) => itemByHref(items, href))
      .filter((item): item is DeskNavItem => Boolean(item));
    if (groupItems.length) entries.push({ kind: "group", block, groupItems });
  }

  const navBody = (
    <div className="space-y-0.5">
      {entries.map((entry) => {
        if (entry.kind === "link") {
          return renderLink(entry.item.href, entry.item.label);
        }
        const open = isGroupOpen(entry.block.id, entry.block.hrefs);
        const GroupIcon = SIDEBAR_GROUP_ICONS[entry.block.id] ?? NAV_ICONS[entry.groupItems[0]!.href] ?? Factory;
        const groupActive = entry.groupItems.some((item) => isActive(item.href));
        return (
          <div key={entry.block.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleGroup(entry.block.id, entry.block.hrefs)}
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                groupActive
                  ? "bg-[var(--accent)] font-semibold text-[var(--on-accent)]"
                  : "text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text-strong)]"
              }`}
            >
              <GroupIcon
                className={`size-[18px] shrink-0 ${groupActive ? "text-[var(--on-accent)]" : ""}`}
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="flex-1 truncate text-left">{entry.block.label}</span>
              <ChevronRight
                className={`size-4 shrink-0 transition-transform duration-200 ${groupActive ? "text-[var(--on-accent)]" : "text-[var(--sb-section-label)]"} ${open ? "rotate-90" : ""}`}
                strokeWidth={1.75}
                aria-hidden
              />
            </button>
            {open ? (
              <div className="mt-0.5 space-y-0.5 pb-1">
                {entry.groupItems.map((item) => renderLink(item.href, item.label, true))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const aside = (
    <aside
      style={{ width: SIDEBAR_WIDTH }}
      className="sidebar-scroll flex h-full shrink-0 flex-col border-r border-[var(--sb-border)] bg-[var(--sb-bg)] px-2 pb-4 pt-3 text-[var(--sb-text)]"
    >
      <div className="mb-2 border-b border-[var(--sb-border)] px-2 pb-3.5">
        <Link
          href="https://ss-metals-ruby.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <div className="relative size-[36px] shrink-0 overflow-hidden rounded-[10px] shadow-xs">
            <Image
              src="/brand/ss-badge-blue.png"
              alt="SS Metals"
              width={36}
              height={36}
              priority
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-bold tracking-[0.03em] text-[15px] leading-tight text-[var(--sb-text-strong)]">
              SS METALS
            </span>
            <span className="mt-1 block font-mono text-[9.5px] font-medium tracking-[0.08em] text-[var(--sb-label)] leading-none uppercase">
              EST. 1987 · MORADABAD
            </span>
          </div>
        </Link>
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
            className="relative flex h-full max-w-[260px] flex-col bg-[var(--sb-bg)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-end border-b border-[var(--sb-border)] p-2">
              <button
                type="button"
                className="grid size-10 place-items-center rounded-lg text-[var(--sb-text)] hover:bg-[var(--sb-hover)]"
                onClick={onMobileClose}
                aria-label="Close menu"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            {aside}
          </div>
        </div>
      ) : null}
    </>
  );
}

export { SIDEBAR_WIDTH };

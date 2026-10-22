"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell, type BellNote } from "@/components/notification-bell";
import { DeskNavGreeting, DeskNavUserChip, DeskSignOutButton } from "@/components/desk-user-menu";

export function DeskTopbar({
  items,
  notes,
  unread,
  greetingLabel,
  dateLabel,
  userName,
  onOpenMenu,
}: {
  items: { href: string; label: string; group: string }[];
  notes: BellNote[];
  unread: number;
  greetingLabel: string;
  dateLabel: string;
  userName: string;
  onOpenMenu: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:gap-4 lg:px-8">
      <button
        type="button"
        className="cursor-pointer grid size-10 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--bg)] lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" strokeWidth={1.7} />
      </button>

      <div className="flex min-w-0 shrink-0 items-center gap-3 lg:gap-4">
        <div className="shrink-0 lg:hidden">
          <BrandLogo variant="navbar" />
        </div>
        <DeskNavGreeting greetingLabel={greetingLabel} dateLabel={dateLabel} />
      </div>

      <div className="relative ml-auto hidden w-[260px] lg:block xl:w-[300px]">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-[18px] text-[var(--ink-muted)]" strokeWidth={1.7} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a page"
          aria-label="Find a page"
          className="h-10 w-full rounded-lg border border-transparent bg-[var(--bg)] pr-3 pl-10 text-sm text-[var(--ink)] outline-none transition focus-visible:border-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
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

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:ml-0">
        <NotificationBell notes={notes} unread={unread} variant="desk" />
        <DeskNavUserChip name={userName} />
        <DeskSignOutButton />
      </div>
    </header>
  );
}

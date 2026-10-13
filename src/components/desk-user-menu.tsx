"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function DeskUserMenu({
  name,
  showShop,
}: {
  name: string;
  showShop: boolean;
}) {
  const router = useRouter();
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SF";

  return (
    <div className="flex items-center gap-3 border-l border-[var(--border)] pl-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--bg)] text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--border)]">
        {initials}
      </span>
      <div className="hidden min-w-0 max-w-[160px] sm:block">
        <p className="truncate text-sm font-medium text-[var(--ink)]">{name}</p>
        {showShop ? (
          <Link
            href="/shop"
            className="text-xs text-[var(--ink-muted)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
          >
            Shop floor
          </Link>
        ) : (
          <p className="text-xs text-[var(--ok)]">Session active</p>
        )}
      </div>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        onClick={async () => {
          await fetch("/api/v1/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        }}
      >
        <LogOut className="size-[18px]" strokeWidth={1.7} />
      </button>
    </div>
  );
}

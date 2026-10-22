"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "@/components/toast";

export function DeskSignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Sign out"
      title="Sign out"
      className="cursor-pointer grid size-10 shrink-0 place-items-center rounded-lg text-[var(--danger)] transition hover:bg-[var(--danger-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
      onClick={async () => {
        try {
          const res = await fetch("/api/v1/auth/logout", { method: "POST" });
          if (!res.ok) {
            throw new Error("Sign out failed. Please try again.");
          }
          router.push("/login");
          router.refresh();
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Sign out failed. Check your connection.";
          toast.error(msg);
        }
      }}
    >
      <LogOut className="size-[18px]" strokeWidth={1.75} />
    </button>
  );
}

export function DeskNavUserChip({ name }: { name: string }) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "SF";

  return (
    <div className="flex items-center gap-2.5 border-l border-[var(--border)] pl-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--bg)] text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--border)]">
        {initials}
      </span>
      <p className="hidden max-w-[140px] truncate text-sm font-medium text-[var(--ink)] sm:block">{name}</p>
    </div>
  );
}

export function DeskNavGreeting({
  greetingLabel,
  dateLabel,
}: {
  greetingLabel: string;
  dateLabel: string;
}) {
  return (
    <div className="min-w-0 border-l border-[var(--border)] pl-3 lg:pl-4">
      <p className="truncate text-sm font-semibold text-[var(--ink)]">
        Welcome back, {greetingLabel}
      </p>
      <p className="truncate text-xs text-[var(--ink-muted)]">{dateLabel}</p>
    </div>
  );
}

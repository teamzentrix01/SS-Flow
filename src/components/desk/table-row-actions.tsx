"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type RowAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
};

const baseClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40";

export function TableRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {actions.map((action) => {
        const toneClass =
          action.tone === "danger"
            ? "text-[var(--ink-muted)] hover:bg-red-50 hover:text-red-700"
            : "text-[var(--ink-muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]";
        const content = (
          <>
            <action.icon className="size-4 shrink-0" strokeWidth={1.7} aria-hidden />
            <span>{action.label}</span>
          </>
        );
        if (action.href && !action.disabled) {
          return (
            <Link
              key={action.label}
              href={action.href}
              aria-label={action.label}
              title={action.label}
              className={`${baseClass} ${toneClass}`}
            >
              {content}
            </Link>
          );
        }
        return (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            title={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            className={`${baseClass} ${toneClass}`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

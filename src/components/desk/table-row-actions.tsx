"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { toast } from "@/components/toast";

export type RowAction = {
  label: string;
  href?: string;
  onClick?: () => void | Promise<unknown>;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
};

const baseClass =
  "cursor-pointer inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed";

export function TableRowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex items-center justify-end gap-0.5" data-row-action>
      {actions.map((action) => {
        const toneClass =
          action.tone === "danger"
            ? "text-red-600 hover:bg-red-50 hover:text-red-700"
            : "text-[var(--ink-muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]";
        const content = <action.icon className="size-4 shrink-0" strokeWidth={1.7} aria-hidden />;
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
            onClick={async () => {
              if (action.disabled) return;
              try {
                const res = action.onClick?.();
                if (res && typeof (res as unknown as Promise<unknown>).catch === "function") {
                  await (res as Promise<unknown>).catch((err: unknown) => {
                    const message =
                      err instanceof Error
                        ? err.message
                        : typeof err === "string"
                          ? err
                          : "Action failed. Please try again.";
                    toast.error(message);
                  });
                }
              } catch (err: unknown) {
                const message =
                  err instanceof Error
                    ? err.message
                    : typeof err === "string"
                      ? err
                      : "Action failed. Please try again.";
                toast.error(message);
              }
            }}
            className={`${baseClass} ${toneClass}`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

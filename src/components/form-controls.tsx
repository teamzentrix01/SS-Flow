"use client";

import { toast } from "@/components/toast";

export function Button({
  children,
  pending,
  disabled = false,
  tone = "primary",
  type = "submit",
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
  tone?: "primary" | "ghost" | "danger" | "success";
  type?: "submit" | "button";
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "btn-primary"
      : tone === "danger"
        ? "h-11 rounded-[10px] bg-danger px-4 text-sm font-semibold text-white hover:opacity-90"
        : tone === "success"
          ? "h-11 rounded-[10px] bg-success px-4 text-sm font-semibold text-white hover:opacity-90"
          : "h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent-soft hover:border-accent/30";

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (pending) return;
    if (!onClick) return;
    try {
      const result = onClick(event);
      if (result && typeof (result as unknown as Promise<unknown>).catch === "function") {
        await (result as Promise<unknown>).catch((err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : typeof err === "string"
                ? err
                : "An unexpected error occurred while executing this action.";
          toast.error(message);
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "An unexpected error occurred while executing this action.";
      toast.error(message);
    }
  };

  return (
    <button
      type={type}
      disabled={pending || disabled}
      onClick={onClick ? handleClick : undefined}
      className={`cursor-pointer inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-60 ${toneClass} ${className}`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-11 w-full rounded-[10px] border border-border bg-card px-3 text-foreground outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "error" | "success" | "info" | "warning";

export type ToastMessage = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
};

type ToastListener = () => void;

let toasts: ToastMessage[] = [];
const listeners = new Set<ToastListener>();
const EMPTY_TOASTS: ToastMessage[] = [];

function subscribe(listener: ToastListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return toasts;
}

function getServerSnapshot() {
  return EMPTY_TOASTS;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function showToast(
  message: string,
  type: ToastType = "info",
  options?: { title?: string; duration?: number }
) {
  const id = crypto.randomUUID();
  const duration = options?.duration ?? (type === "error" ? 6000 : 3500);
  const newToast: ToastMessage = {
    id,
    type,
    message,
    title: options?.title,
    duration,
  };

  // Avoid spamming exact duplicate messages
  const existing = toasts.find((t) => t.message === message && t.type === type);
  if (existing) {
    return existing.id;
  }

  toasts = [...toasts, newToast];
  notify();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export const toast = {
  error: (message: string, options?: { title?: string; duration?: number }) =>
    showToast(message, "error", options),
  success: (message: string, options?: { title?: string; duration?: number }) =>
    showToast(message, "success", options),
  info: (message: string, options?: { title?: string; duration?: number }) =>
    showToast(message, "info", options),
  warning: (message: string, options?: { title?: string; duration?: number }) =>
    showToast(message, "warning", options),
  dismiss: dismissToast,
};

export function ToastContainer() {
  const activeToasts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    // Global listener for unhandled promise rejections
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "An unexpected error occurred while processing your action.";
      // Don't show toast for Next.js navigation redirects
      if (
        message.includes("NEXT_REDIRECT") ||
        message.includes("NEXT_NOT_FOUND")
      ) {
        return;
      }
      toast.error(message, { title: "Action Error" });
    }

    // Global listener for form validation failures
    function onInvalid(event: Event) {
      const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!target || !target.form) return;

      const labelEl = target.id ? document.querySelector(`label[for="${target.id}"]`) : null;
      const fieldName =
        labelEl?.textContent?.replace(/\*/g, "").trim() ||
        target.getAttribute("aria-label") ||
        target.name ||
        "required field";

      const message = target.validationMessage
        ? `${fieldName ? `${fieldName}: ` : ""}${target.validationMessage}`
        : `Please fill out the ${fieldName}.`;

      toast.error(message, { title: "Validation Error" });
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    document.addEventListener("invalid", onInvalid, true);

    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("invalid", onInvalid, true);
    };
  }, []);

  if (activeToasts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="fixed top-4 right-4 z-[99999] flex max-w-sm w-[calc(100vw-2rem)] flex-col gap-2.5 pointer-events-none"
    >
      {activeToasts.map((item) => {
        const isError = item.type === "error";
        const isSuccess = item.type === "success";
        const isWarning = item.type === "warning";

        return (
          <div
            key={item.id}
            role={isError ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
              isError
                ? "border-[var(--danger-border)] bg-[var(--surface)] text-[var(--danger)] ring-1 ring-[var(--danger)]/15"
                : isSuccess
                  ? "border-[var(--success-border)] bg-[var(--surface)] text-[var(--success)] ring-1 ring-[var(--success)]/15"
                  : isWarning
                    ? "border-[var(--warning-border)] bg-[var(--surface)] text-[var(--warning)] ring-1 ring-[var(--warning)]/15"
                    : "border-[var(--info-border)] bg-[var(--surface)] text-[var(--info)] ring-1 ring-[var(--info)]/15"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isError ? (
                <AlertCircle className="size-5 text-[var(--danger)]" />
              ) : isSuccess ? (
                <CheckCircle2 className="size-5 text-[var(--success)]" />
              ) : (
                <Info className="size-5 text-[var(--info)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {item.title ? (
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-0.5">
                  {item.title}
                </p>
              ) : null}
              <p className="text-sm font-medium text-[var(--ink)] leading-snug break-words">
                {item.message}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dismissToast(item.id)}
              className="cursor-pointer shrink-0 rounded-md p-1 text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

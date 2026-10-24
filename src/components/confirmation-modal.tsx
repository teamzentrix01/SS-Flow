"use client";

import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Trash2, X } from "lucide-react";

export type ModalTone = "danger" | "warning" | "success" | "neutral";

export type ConfirmOptions = {
  title: string;
  message: React.ReactNode;
  consequence?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ModalTone;
  icon?: typeof Trash2;
  onConfirm: () => void | Promise<unknown>;
};

export type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<unknown>;
  title: string;
  message: React.ReactNode;
  consequence?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ModalTone;
  icon?: typeof Trash2;
  pending?: boolean;
};

const toneConfig: Record<
  ModalTone,
  {
    icon: typeof Trash2;
    badgeBg: string;
    badgeRing: string;
    iconStroke: string;
    confirmBtnClass: string;
    confirmFocusRing: string;
  }
> = {
  danger: {
    icon: Trash2,
    badgeBg: "bg-[#FEF3F2]",
    badgeRing: "shadow-[0_0_0_8px_#FEE4E2]",
    iconStroke: "stroke-[#D92D20]",
    confirmBtnClass:
      "border-[#B42318] bg-[#D92D20] text-white hover:bg-[#B42318] shadow-[0_1px_2px_rgba(16,24,40,0.05),inset_0_1px_0_rgba(255,255,255,0.18)]",
    confirmFocusRing: "focus-visible:ring-[#D92D20]",
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: "bg-[#FEF0C7]",
    badgeRing: "shadow-[0_0_0_8px_#FFFAEB]",
    iconStroke: "stroke-[#DC6803]",
    confirmBtnClass:
      "border-[#B54708] bg-[#DC6803] text-white hover:bg-[#B54708] shadow-[0_1px_2px_rgba(16,24,40,0.05),inset_0_1px_0_rgba(255,255,255,0.18)]",
    confirmFocusRing: "focus-visible:ring-[#DC6803]",
  },
  success: {
    icon: CheckCircle2,
    badgeBg: "bg-[#DCFAE6]",
    badgeRing: "shadow-[0_0_0_8px_#ECFDF3]",
    iconStroke: "stroke-[#079455]",
    confirmBtnClass:
      "border-[#067647] bg-[#079455] text-white hover:bg-[#067647] shadow-[0_1px_2px_rgba(16,24,40,0.05),inset_0_1px_0_rgba(255,255,255,0.18)]",
    confirmFocusRing: "focus-visible:ring-[#079455]",
  },
  neutral: {
    icon: Info,
    badgeBg: "bg-[#F2F4F7]",
    badgeRing: "shadow-[0_0_0_8px_#F8F9FA]",
    iconStroke: "stroke-[#344054]",
    confirmBtnClass:
      "border-[#101828] bg-[#1D2939] text-white hover:bg-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.05),inset_0_1px_0_rgba(255,255,255,0.18)]",
    confirmFocusRing: "focus-visible:ring-[#1D2939]",
  },
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  consequence,
  confirmText,
  cancelText = "Cancel",
  tone = "danger",
  icon: customIcon,
  pending = false,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const cfg = toneConfig[tone] ?? toneConfig.danger;
  const Icon = customIcon ?? cfg.icon;

  const defaultConfirmText =
    confirmText ??
    (tone === "danger"
      ? "Delete product"
      : tone === "warning"
        ? "Confirm action"
        : tone === "success"
          ? "Confirm"
          : "Continue");

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pending, onClose]);

  // Initial focus goes on the Cancel button (safer default)
  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 animate-in fade-in"
      onMouseDown={(e) => {
        if (!pending && e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-description"
        className="relative w-full max-w-[560px] mx-4 sm:mx-auto rounded-[20px] bg-white p-6 sm:p-8 font-['Plus_Jakarta_Sans',sans-serif] shadow-[0_1px_2px_rgba(16,24,40,0.06),0_24px_48px_-12px_rgba(16,24,40,0.22),0_0_0_1px_rgba(16,24,40,0.04)] transition-all"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 1. Close button: absolute top-5 right-5, 36x36, rounded-[10px], X icon (18px), color #8A909C, hover bg #F2F4F7 */}
        <button
          type="button"
          disabled={pending}
          onClick={onClose}
          aria-label="Close dialog"
          className="cursor-pointer absolute top-5 right-5 flex size-[36px] items-center justify-center rounded-[10px] text-[#8A909C] transition hover:bg-[#F2F4F7] hover:text-[#5B616E] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
        >
          <X className="size-[18px]" strokeWidth={2} />
        </button>

        {/* 2. Icon badge: 52x52 circle, bg #FEF3F2, 8px outer ring in #FEE4E2. Inside it, Trash2 icon, 26px, stroke #D92D20. Margin: 8px top and left, 28px bottom */}
        <div
          className={`mt-2 ml-2 mb-7 flex size-[52px] items-center justify-center rounded-full ${cfg.badgeBg} ${cfg.badgeRing}`}
        >
          <Icon className={`size-[26px] ${cfg.iconStroke}`} strokeWidth={1.8} aria-hidden />
        </div>

        {/* 3. Title: 22px, font-bold, color #16181D, letter-spacing -0.01em, line-height 1.25 */}
        <h2
          id="confirm-modal-title"
          className="text-[22px] font-bold leading-[1.25] tracking-[-0.01em] text-[#16181D]"
        >
          {title}
        </h2>

        {/* 4. Description: 15px, line-height 1.6, color #5B616E, max-w-[440px], mt-2 */}
        <div
          id="confirm-modal-description"
          className="mt-2 max-w-[440px] text-[15px] leading-[1.6] text-[#5B616E]"
        >
          {message}
        </div>

        {/* 5. Info note: mt-6, bg #F7F8FA, 1px border #E6E8EC, rounded-xl, px-[18px] py-4, flex gap-3 items-start. Left: Info icon (18px, #667085, mt-0.5, shrink-0). Right: 13.5px, line-height 1.6, color #4A505C */}
        {consequence ? (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#E6E8EC] bg-[#F7F8FA] px-[18px] py-4">
            <Info
              className="size-[18px] shrink-0 text-[#667085] mt-0.5"
              strokeWidth={1.8}
              aria-hidden
            />
            <div className="min-w-0 flex-1 text-[13.5px] leading-[1.6] text-[#4A505C]">
              {consequence}
            </div>
          </div>
        ) : null}

        {/* 6. Footer: mt-7, pt-6, border-t 1px #E6E8EC, flex justify-end gap-3. Mobile (<480px): stack with Delete on top */}
        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E6E8EC] pt-6 sm:flex-row sm:justify-end">
          {/* Cancel button: h-11, px-5, rounded-[10px], bg white, 1px border #D5D8DE, text #2B2F38, 14.5px font-semibold, shadow-sm. Hover: bg #F9FAFB */}
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={pending}
            onClick={onClose}
            className="cursor-pointer inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#D5D8DE] bg-white px-5 text-[14.5px] font-semibold text-[#2B2F38] shadow-xs transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 sm:w-auto"
          >
            {cancelText}
          </button>

          {/* Delete button: label "Delete product", h-11, px-5, rounded-[10px], bg #D92D20, 1px border #B42318, text white, 14.5px font-semibold, shadow-sm plus inset 0 1px 0 rgba(255,255,255,.18). Hover: bg #B42318 */}
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className={`cursor-pointer inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border px-5 text-[14.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${cfg.confirmBtnClass} ${cfg.confirmFocusRing}`}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Deleting…</span>
              </>
            ) : (
              <span>{defaultConfirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmModal() {
  const [state, setState] = React.useState<ConfirmOptions | null>(null);
  const [pending, setPending] = React.useState(false);

  const confirm = (options: ConfirmOptions) => {
    setState(options);
  };

  const close = () => {
    if (pending) return;
    setState(null);
  };

  const handleConfirm = async () => {
    if (!state || pending) return;
    try {
      setPending(true);
      await state.onConfirm();
      setState(null);
    } catch {
      // Error handling is managed by onConfirm or toast
    } finally {
      setPending(false);
    }
  };

  const ConfirmDialog = state ? (
    <ConfirmationModal
      isOpen={true}
      onClose={close}
      onConfirm={handleConfirm}
      pending={pending}
      title={state.title}
      message={state.message}
      consequence={state.consequence}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      tone={state.tone}
      icon={state.icon}
    />
  ) : null;

  return { confirm, ConfirmDialog, isOpen: Boolean(state) };
}

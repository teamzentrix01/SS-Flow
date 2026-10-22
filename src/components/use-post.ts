"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDialogClose } from "@/components/create-dialog";
import { toast } from "@/components/toast";

export type PostRedirectOptions = {
  redirectTo?: string;
  successMessage?: string;
  /** Delay before redirect so the success message is visible (ms). */
  delayMs?: number;
  /** No success banner; redirect immediately (e.g. login). */
  silent?: boolean;
};

export type PostRedirect = string | PostRedirectOptions;

function resolveRedirect(redirect?: PostRedirect): PostRedirectOptions {
  if (!redirect) return {};
  if (typeof redirect === "string") return { redirectTo: redirect };
  return redirect;
}

function errorMessageFromJson(json: unknown): string {
  if (!json || typeof json !== "object") return "The request failed. Please try again.";
  const root = json as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof root.message === "string" && root.message.trim()) return root.message;
  return "The request failed. Please try again.";
}

export function usePost() {
  const router = useRouter();
  const closeDialog = useDialogClose();
  const key = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function post(url: string, body: unknown, redirect?: PostRedirect) {
    setPending(true);
    setError(null);
    setSuccess(null);
    const { redirectTo, successMessage, delayMs = 1600, silent = false } = resolveRedirect(redirect);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key.current,
        },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMsg = errorMessageFromJson(json);
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }
      key.current = crypto.randomUUID();
      closeDialog?.();

      const message = successMessage ?? "Saved successfully.";
      if (!silent) {
        setSuccess(message);
        const wait = redirectTo ? delayMs : 900;
        await new Promise((resolve) => setTimeout(resolve, wait));
      }

      if (redirectTo && redirectTo !== window.location.pathname) {
        router.push(redirectTo);
      }
      router.refresh();
      return json?.data ?? null;
    } catch {
      const errorMsg = "Could not reach the server. Check your connection and try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    } finally {
      setPending(false);
    }
  }

  return { post, error, success, pending };
}

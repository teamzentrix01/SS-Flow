"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDialogClose } from "@/components/create-dialog";

export type PostRedirectOptions = {
  redirectTo: string;
  successMessage?: string;
  /** Delay before redirect so the success message is visible (ms). */
  delayMs?: number;
};

export type PostRedirect = string | PostRedirectOptions;

function resolveRedirect(redirect?: PostRedirect): {
  redirectTo?: string;
  successMessage?: string;
  delayMs?: number;
} {
  if (!redirect) return {};
  if (typeof redirect === "string") return { redirectTo: redirect };
  return redirect;
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
    const { redirectTo, successMessage, delayMs = 1600 } = resolveRedirect(redirect);
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
        setError(
          json?.error?.message ?? "The request failed. Please try again.",
        );
        return null;
      }
      key.current = crypto.randomUUID();
      closeDialog?.();

      if (redirectTo && successMessage) {
        setSuccess(successMessage);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        if (redirectTo !== window.location.pathname) {
          router.push(redirectTo);
        }
        router.refresh();
        return json?.data ?? null;
      }

      if (redirectTo && redirectTo !== window.location.pathname) router.push(redirectTo);
      router.refresh();
      return json?.data ?? null;
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
      return null;
    } finally {
      setPending(false);
    }
  }

  return { post, error, success, pending };
}

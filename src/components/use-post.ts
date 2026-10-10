"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useDialogClose } from "@/components/create-dialog";

export function usePost() {
  const router = useRouter();
  const closeDialog = useDialogClose();
  const key = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function post(url: string, body: unknown, redirectTo?: string) {
    setPending(true);
    setError(null);
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

  return { post, error, pending };
}

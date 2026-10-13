"use client";

import { usePost } from "@/components/use-post";

export function MarkNotificationsRead({ disabled }: { disabled: boolean }) {
  const { post, pending, error } = usePost();
  return (
    <div className="text-right">
      <button
        type="button"
        disabled={disabled || pending}
        className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => void post("/api/v1/notifications/read", {})}
      >
        {pending ? "Updating…" : "Mark all read"}
      </button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

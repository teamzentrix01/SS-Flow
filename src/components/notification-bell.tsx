"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { usePost } from "@/components/use-post";

export type BellNote = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  unread: boolean;
  when: string;
};

export function NotificationBell({ notes, unread }: { notes: BellNote[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { post, pending } = usePost();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative ml-auto md:ml-0" ref={ref}>
      <button
        type="button"
        className="relative grid size-10 place-items-center rounded-[10px] border border-border"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-graphite">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="absolute top-12 right-0 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="font-semibold">Notifications</p>
            <button
              type="button"
              disabled={unread === 0 || pending}
              className="text-sm font-semibold text-steel disabled:opacity-40"
              onClick={() => void post("/api/v1/notifications/read", {})}
            >
              {pending ? "Updating…" : "Mark all read"}
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notes.length ? (
              notes.map((note) => {
                const body = (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold">{note.title}</span>
                      {note.unread ? <span className="mt-1 size-2 shrink-0 rounded-full bg-coral" aria-label="Unread" /> : null}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{note.body}</span>
                    <span className="mt-1 block text-xs text-muted">{note.when}</span>
                  </>
                );
                return note.href ? (
                  <Link key={note.id} href={note.href} onClick={() => setOpen(false)} className="block border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-muted">
                    {body}
                  </Link>
                ) : (
                  <div key={note.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    {body}
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-6 text-sm text-muted">No notifications yet.</p>
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-3 text-center text-sm font-semibold hover:bg-surface-muted">
            View all
          </Link>
        </div>
      ) : null}
    </div>
  );
}

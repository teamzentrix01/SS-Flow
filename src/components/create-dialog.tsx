"use client";

import { createContext, useContext, useEffect, useState } from "react";

const DialogCloseContext = createContext<(() => void) | null>(null);

export function useDialogClose() {
  return useContext(DialogCloseContext);
}

export function CreateDialog({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>{label}</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#242626]/55 p-3 sm:items-center sm:p-6" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{title}</h2>
              <button type="button" className="h-10 rounded-[10px] border border-border px-3 text-sm font-semibold" onClick={() => setOpen(false)}>Close</button>
            </div>
            <DialogCloseContext.Provider value={() => setOpen(false)}>{children}</DialogCloseContext.Provider>
          </div>
        </div>
      ) : null}
    </>
  );
}

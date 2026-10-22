import { Suspense } from "react";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="text-sm text-muted">Loading inventory…</p>}>{children}</Suspense>;
}

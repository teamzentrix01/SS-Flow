export default function Loading() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="h-8 w-56 rounded-lg bg-surface-muted" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-28 rounded-2xl bg-surface-muted" />
        <div className="h-28 rounded-2xl bg-surface-muted" />
        <div className="h-28 rounded-2xl bg-surface-muted" />
      </div>
      <div className="h-64 rounded-2xl bg-surface-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

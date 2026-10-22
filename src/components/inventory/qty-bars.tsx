export function InventoryBarChart({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  const max = Math.max(0, ...items.map((item) => Number(item.value)));
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length && max > 0 ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const width = max > 0 ? Math.max(2, (Number(item.value) / max) * 100) : 0;
            return (
              <li key={item.label}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted">{item.label}</span>
                  <span className="tabular-nums font-medium">{Number(item.value).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-soft">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No posted quantities for the current filters.</p>
      )}
    </section>
  );
}

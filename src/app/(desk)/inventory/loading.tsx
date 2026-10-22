export default function InventoryLoading() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-soft" />
      <div className="h-24 animate-pulse rounded-xl bg-neutral-soft" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-xl bg-neutral-soft" />
        ))}
      </div>
    </div>
  );
}

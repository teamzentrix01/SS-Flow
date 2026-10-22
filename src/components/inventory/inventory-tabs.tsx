import Link from "next/link";

export function InventoryTabs({
  tabs,
  current,
}: {
  tabs: { id: string; label: string; href: string }[];
  current: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      {tabs.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

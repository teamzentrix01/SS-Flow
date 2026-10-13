import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function DeskPrimaryCta({
  href,
  children,
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="btn-dashboard-primary inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
    >
      {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.7} aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function DeskSecondaryCta({
  href,
  children,
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="btn-dashboard-secondary inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium"
    >
      {Icon ? <Icon className="size-4 shrink-0" strokeWidth={1.7} aria-hidden /> : null}
      {children}
    </Link>
  );
}

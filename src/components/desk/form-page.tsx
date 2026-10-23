import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function DeskFormPage({
  title,
  detail,
  backHref,
  backLabel = "Back to list",
  children,
  boxed = true,
  wide = false,
}: {
  title: string;
  detail?: string;
  backHref: string;
  backLabel?: string;
  children: React.ReactNode;
  boxed?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`mx-auto space-y-6 px-1 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-muted)] transition hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden />
        {backLabel}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">{title}</h1>
        {detail ? <p className="mt-1 text-sm text-[var(--ink-muted)]">{detail}</p> : null}
      </div>
      {boxed ? (
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

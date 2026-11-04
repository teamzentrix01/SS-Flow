import Link from "next/link";
import type { DuplicateMatch } from "@/modules/leads/duplicates";
import { leadStatusLabel } from "@/modules/leads/status";

export function LeadPossibleDuplicates({ matches }: { matches: DuplicateMatch[] }) {
  if (!matches.length) return null;
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Possible duplicates</h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {matches.map((match) => (
          <li key={`${match.kind}-${match.id}`}>
            {match.href ? (
              <Link className="font-medium text-accent hover:underline" href={match.href}>
                {match.label}
              </Link>
            ) : (
              <span className="font-medium">{match.label}</span>
            )}
            <span className="text-muted">
              {" "}
              · {match.kind}
              {match.status ? ` · ${leadStatusLabel(match.status)}` : ""} · matched {match.reason}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

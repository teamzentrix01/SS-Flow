"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { controlClass } from "@/components/ui";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/modules/leads/status";

export function LeadListFilters({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`/leads?${next.toString()}`);
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
      <label className="grid gap-1 text-sm md:col-span-2">
        <span className="font-medium">Search</span>
        <input
          className={controlClass}
          defaultValue={params.get("q") ?? ""}
          placeholder="Name, phone, lead #"
          onBlur={(e) => update("q", e.target.value.trim())}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Status</span>
        <select className={controlClass} value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
          <option value="">All</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Source</span>
        <select className={controlClass} value={params.get("source") ?? ""} onChange={(e) => update("source", e.target.value)}>
          <option value="">All</option>
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Assignee</span>
        <select
          className={controlClass}
          value={params.get("assigneeId") ?? ""}
          onChange={(e) => update("assigneeId", e.target.value)}
        >
          <option value="">All</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-2 md:col-span-5">
        <Link
          href={params.get("overdue") ? "/leads" : "/leads?overdue=1"}
          className={`rounded-full px-3 py-1 text-sm font-medium ${params.get("overdue") ? "bg-warning-soft text-warning" : "border border-neutral-soft bg-card text-neutral hover:border-neutral hover:bg-neutral-soft"}`}
        >
          Overdue follow-ups
        </Link>
        <Link
          href={params.get("unconfirmed") ? "/leads" : "/leads?unconfirmed=1"}
          className={`rounded-full px-3 py-1 text-sm font-medium ${params.get("unconfirmed") ? "bg-info-soft text-info" : "border border-neutral-soft bg-card text-neutral hover:border-neutral hover:bg-neutral-soft"}`}
        >
          Unconfirmed promised dates
        </Link>
        <Link href="/leads" className="text-sm text-accent underline">
          Clear filters
        </Link>
      </div>
    </div>
  );
}

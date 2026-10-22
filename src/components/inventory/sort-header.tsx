"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function SortHeader({ action, id, label }: { action: string; id: string; label: string }) {
  const params = useSearchParams();
  const current = params.get("sort");
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const nextDir = current === id && dir === "asc" ? "desc" : "asc";
  const search = new URLSearchParams(params.toString());
  search.set("sort", id);
  search.set("dir", nextDir);
  search.delete("page");
  const marker = current === id ? (dir === "asc" ? " ↑" : " ↓") : "";
  return (
    <Link href={`${action}?${search.toString()}`} className="hover:text-foreground">
      {label}
      {marker}
    </Link>
  );
}

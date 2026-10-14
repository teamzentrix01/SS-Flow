"use client";

import Link from "next/link";

export function DesignationRowActions({ id }: { id: string }) {
  return (
    <Link href={`/designations/${id}/edit`} className="text-sm font-semibold text-accent">
      Edit
    </Link>
  );
}

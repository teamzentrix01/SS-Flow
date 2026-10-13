"use client";

import { Eye } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";

export function JobRowActions({ id }: { id: string }) {
  return <TableRowActions actions={[{ label: "View job", href: `/jobs/${id}`, icon: Eye }]} />;
}

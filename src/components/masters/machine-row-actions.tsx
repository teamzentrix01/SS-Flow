"use client";

import { Eye } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";

export function MachineRowActions({ id }: { id: string }) {
  return <TableRowActions actions={[{ label: "View", href: `/machines/${id}`, icon: Eye }]} />;
}

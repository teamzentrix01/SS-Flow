"use client";

import { Eye } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";

export function JobOrderRowActions({ productionOrderId }: { productionOrderId: string }) {
  return (
    <TableRowActions
      actions={[{ label: "View work order", href: `/jobs/orders/${productionOrderId}`, icon: Eye }]}
    />
  );
}

"use client";

import { Eye, Layers, Pencil } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";

export function ProductRowActions({ id, showBom }: { id: string; showBom: boolean }) {
  return (
    <TableRowActions
      actions={[
        { label: "View stock SKU", href: `/products/${id}`, icon: Eye },
        { label: "Edit stock SKU", href: `/products/${id}/edit`, icon: Pencil },
        ...(showBom
          ? [{ label: "Open bill of materials", href: `/products/${id}/bom`, icon: Layers }]
          : []),
      ]}
    />
  );
}

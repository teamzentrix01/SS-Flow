"use client";

import { Eye, Layers, Pencil } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";

export function ProductRowActions({ id, showBom }: { id: string; showBom: boolean }) {
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/masters/products/${id}`, icon: Eye },
        { label: "Edit", href: `/masters/products/${id}/edit`, icon: Pencil },
        ...(showBom
          ? [{ label: "BOM", href: `/masters/products/${id}/bom`, icon: Layers }]
          : []),
      ]}
    />
  );
}

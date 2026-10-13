"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function CategoryRowActions({ id, canDelete }: { id: string; canDelete: boolean }) {
  const { post, pending } = usePost();
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/masters/categories/${id}`, icon: Eye },
        { label: "Edit", href: `/masters/categories/${id}/edit`, icon: Pencil },
        {
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: !canDelete || pending,
          onClick: () => {
            if (!canDelete || pending) return;
            if (!window.confirm("Delete this category? This cannot be undone.")) return;
            void post(`/api/v1/masters/categories/${id}/delete`, {}, "/masters/categories");
          },
        },
      ]}
    />
  );
}

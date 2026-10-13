"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function CategoryRowActions({ id, canDelete }: { id: string; canDelete: boolean }) {
  const { post, pending } = usePost();
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/categories/${id}`, icon: Eye },
        { label: "Edit", href: `/categories/${id}/edit`, icon: Pencil },
        {
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: !canDelete || pending,
          onClick: () => {
            if (!canDelete || pending) return;
            if (!window.confirm("Remove this category? It will be hidden from lists.")) return;
            void post(`/api/v1/categories/${id}/delete`, {}, "/categories");
          },
        },
      ]}
    />
  );
}

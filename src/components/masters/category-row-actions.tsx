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
          confirm: {
            title: "Delete category?",
            message: "You're about to remove this category from the active list.",
            consequence: (
              <>
                <strong className="font-semibold text-slate-800 dark:text-slate-100">
                  Hidden from category lists.
                </strong>{" "}
                Existing catalog items and history remain preserved.
              </>
            ),
            confirmText: "Delete category",
            cancelText: "Cancel",
            tone: "danger",
          },
          onClick: () => post(`/api/v1/categories/${id}/delete`, {}, "/categories"),
        },
      ]}
    />
  );
}

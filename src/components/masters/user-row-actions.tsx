"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function UserRowActions({ id, self }: { id: string; self: boolean }) {
  const { post, pending } = usePost();
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/users/${id}`, icon: Eye },
        { label: "Edit", href: `/users/${id}/edit`, icon: Pencil },
        {
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: self || pending,
          confirm: {
            title: "Deactivate user?",
            message: "You're about to remove this user account.",
            consequence: (
              <>
                <strong className="font-semibold text-slate-800 dark:text-slate-100">
                  Account login disabled.
                </strong>{" "}
                Audit logs and assigned historical records are preserved.
              </>
            ),
            confirmText: "Deactivate user",
            cancelText: "Cancel",
            tone: "danger",
          },
          onClick: () => post(`/api/v1/users/${id}/delete`, {}, "/users"),
        },
      ]}
    />
  );
}

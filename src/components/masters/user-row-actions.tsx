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
          onClick: () => {
            if (self || pending) return;
            if (!window.confirm("Remove this user? Their login will be deactivated.")) return;
            void post(`/api/v1/users/${id}/delete`, {}, "/users");
          },
        },
      ]}
    />
  );
}

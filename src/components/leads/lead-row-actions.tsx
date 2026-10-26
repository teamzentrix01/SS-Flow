"use client";

import { Eye, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function LeadRowActions({ id, canDelete }: { id: string; canDelete: boolean }) {
  const { post, pending } = usePost();
  return (
    <TableRowActions
      actions={[
        { label: "View lead", href: `/leads/${id}`, icon: Eye },
        ...(canDelete
          ? [{
              label: "Delete lead",
              icon: Trash2,
              tone: "danger" as const,
              disabled: pending,
              confirm: {
                title: "Delete lead?",
                message: "This lead will be removed from the active lead list. Its history and related records will be preserved.",
                consequence: <b className="font-semibold text-[#16181D]">The lead can no longer be edited or converted.</b>,
                confirmText: "Delete lead",
                cancelText: "Cancel",
                tone: "danger" as const,
              },
              onClick: () => post(`/api/v1/leads/${id}/delete`, {}, "/leads"),
            }]
          : []),
      ]}
    />
  );
}

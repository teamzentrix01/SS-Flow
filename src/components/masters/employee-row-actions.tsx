"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import { TableRowActions } from "@/components/desk/table-row-actions";
import { usePost } from "@/components/use-post";

export function EmployeeRowActions({
  id,
  self,
  canAdmin,
}: {
  id: string;
  self: boolean;
  canAdmin: boolean;
}) {
  const { post, pending } = usePost();
  if (!canAdmin) {
    return <TableRowActions actions={[{ label: "View", href: `/employees/${id}`, icon: Eye }]} />;
  }
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/employees/${id}`, icon: Eye },
        { label: "Edit", href: `/employees/${id}/edit`, icon: Pencil },
        {
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: self || pending,
          confirm: {
            title: "Deactivate employee?",
            message: "You're about to remove this employee record.",
            consequence: (
              <>
                <strong className="font-semibold text-slate-800 dark:text-slate-100">
                  Login and permissions revoked.
                </strong>{" "}
                Historical activity, audit logs, and attendance remain preserved.
              </>
            ),
            confirmText: "Deactivate employee",
            cancelText: "Cancel",
            tone: "danger",
          },
          onClick: () => post(`/api/v1/employees/${id}/delete`, {}, "/employees"),
        },
      ]}
    />
  );
}

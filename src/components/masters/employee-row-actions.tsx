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
    return <TableRowActions actions={[{ label: "View", href: `/people/employees/${id}`, icon: Eye }]} />;
  }
  return (
    <TableRowActions
      actions={[
        { label: "View", href: `/people/employees/${id}`, icon: Eye },
        { label: "Edit", href: `/people/employees/${id}/edit`, icon: Pencil },
        {
          label: "Delete",
          icon: Trash2,
          tone: "danger",
          disabled: self || pending,
          onClick: () => {
            if (self || pending) return;
            if (!window.confirm("Delete this employee and remove their login?")) return;
            void post(`/api/v1/people/employees/${id}/delete`, {}, "/people/employees");
          },
        },
      ]}
    />
  );
}

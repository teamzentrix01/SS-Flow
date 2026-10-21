"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, DeskPrimaryCta } from "@/components/desk";
import { UserRowActions } from "@/components/masters/user-row-actions";
import { controlClass } from "@/components/ui";
import { when } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";

export type DeskUserTableRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  userRoles: { role: { code: string; name: string } }[];
  customer: { code: string; name: string } | null;
  supplier: { code: string; name: string } | null;
};

export function UsersTable({
  users,
  sessionUserId,
  roleOptions,
}: {
  users: DeskUserTableRow[];
  sessionUserId: string;
  roleOptions: { code: string; label: string }[];
}) {
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = useMemo(() => {
    if (!roleFilter) return users;
    return users.filter((row) => row.userRoles.some((link) => link.role.code === roleFilter));
  }, [users, roleFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-[var(--ink)]">Filter by role</span>
          <select
            className={`${controlClass} min-w-[200px]`}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option key={role.code} value={role.code}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        {roleFilter ? (
          <p className="pb-2 text-sm text-[var(--ink-muted)]">
            Showing {filtered.length} of {users.length} users
          </p>
        ) : null}
      </div>
      <DataTable
        columns={[
          { id: "name", header: "Name", cell: (row) => row.name },
          { id: "email", header: "Email", cell: (row) => row.email },
          { id: "phone", header: "Phone", cell: (row) => row.phone ?? "—" },
          {
            id: "roles",
            header: "Role",
            cell: (row) =>
              row.userRoles.map((link) => ROLE_LABELS[link.role.code] ?? link.role.name).join(", ") || "—",
          },
          {
            id: "link",
            header: "Linked to",
            cell: (row) =>
              row.customer
                ? `Customer · ${row.customer.code}`
                : row.supplier
                  ? `Supplier · ${row.supplier.code}`
                  : "—",
          },
          {
            id: "created",
            header: "Created",
            cell: (row) => when(row.createdAt),
          },
          {
            id: "updated",
            header: "Updated",
            cell: (row) => when(row.updatedAt),
          },
          {
            id: "actions",
            header: "Action",
            headerClassName: "w-[120px] text-right",
            cellClassName: "text-right",
            stopRowClick: true,
            cell: (row) => <UserRowActions id={row.id} self={row.id === sessionUserId} />,
          },
        ]}
        rows={filtered}
        getRowKey={(row) => row.id}
        getRowHref={(row) => `/users/${row.id}`}
        emptyTitle={roleFilter ? "No users with this role" : "No users yet"}
        emptyDetail={
          roleFilter
            ? "Try another role or clear the filter."
            : "Create admin, manager, employee, customer, or supplier logins."
        }
        emptyAction={
          !roleFilter ? (
            <DeskPrimaryCta href="/users/new" icon={Plus}>
              Create user account
            </DeskPrimaryCta>
          ) : undefined
        }
      />
    </div>
  );
}

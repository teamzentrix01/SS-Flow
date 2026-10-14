"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { RolePermissionMatrix, type PermissionRow } from "@/components/rbac/role-permission-matrix";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";

type Values = {
  name: string;
  code: string;
  description: string;
  isActive: boolean;
};

export function RoleForm({
  permissions,
  initial,
  redirectTo,
  readOnlySlug,
}: {
  permissions: PermissionRow[];
  initial?: Partial<Values> & { id?: string; permissionCodes?: string[] };
  redirectTo: string;
  readOnlySlug?: boolean;
}) {
  const { post, error, success, pending } = usePost();
  const [permissionCodes, setPermissionCodes] = useState<string[]>(initial?.permissionCodes ?? []);
  const form = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      description: initial?.description ?? "",
      isActive: initial?.isActive ?? true,
    },
  });
  const isEdit = Boolean(initial?.id);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          isEdit ? `/api/v1/roles/${initial!.id}` : "/api/v1/roles",
          { ...values, permissionCodes },
          {
            redirectTo,
            successMessage: isEdit ? "Role updated." : "Role created.",
          },
        ),
      )}
    >
      <Field label="Role name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Slug / code">
        <input
          className={controlClass}
          placeholder="Auto from name if blank"
          readOnly={readOnlySlug}
          {...form.register("code")}
        />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <textarea className={controlClass} rows={2} {...form.register("description")} />
        </Field>
      </div>
      {isEdit ? (
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" {...form.register("isActive")} />
          Active (inactive roles cannot be assigned to users)
        </label>
      ) : null}
      <RolePermissionMatrix
        permissions={permissions}
        value={permissionCodes}
        onChange={setPermissionCodes}
        disabled={readOnlySlug && initial?.code === "admin"}
      />
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>{isEdit ? "Save role" : "Create role"}</Button>
      </div>
    </form>
  );
}

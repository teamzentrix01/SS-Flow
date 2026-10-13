"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";

const USER_ROLES = ["employee", "customer", "supplier"] as const;

type FormValues = {
  name: string;
  phone: string;
  roleCode: (typeof USER_ROLES)[number];
  password: string;
};

export function UserEditForm({
  userId,
  email,
  defaultValues,
}: {
  userId: string;
  email: string;
  defaultValues: FormValues;
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm<FormValues>({ defaultValues });
  const roleCode = useWatch({ control: form.control, name: "roleCode" });
  const [visible, setVisible] = useState(false);
  const permissionLabels = (ROLE_PERMISSIONS[roleCode] ?? []).map(
    (code) => PERMISSIONS.find((item) => item[0] === code)?.[1] ?? code,
  );

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(`/api/v1/users/${userId}`, values, {
          redirectTo: `/users/${userId}`,
          successMessage: "User updated successfully.",
        }),
      )}
    >
      <Field label="Email">
        <input className={controlClass} value={email} readOnly disabled />
      </Field>
      <Field label="Name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Phone">
        <input className={controlClass} type="tel" autoComplete="off" {...form.register("phone")} />
      </Field>
      <Field label="Role category" required>
        <select className={controlClass} required {...form.register("roleCode")}>
          {USER_ROLES.map((code) => (
            <option key={code} value={code}>
              {ROLE_LABELS[code] ?? code}
            </option>
          ))}
        </select>
      </Field>
      <Field label="New password">
        <div className="flex gap-2">
          <input
            className={controlClass}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Leave blank to keep current"
            {...form.register("password")}
          />
          <button type="button" className="btn-ghost shrink-0" onClick={() => setVisible((v) => !v)}>
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <div className="md:col-span-2 space-y-3">
        <p className="text-sm text-muted">This role can: {permissionLabels.join(", ") || "—"}.</p>
        <FormFeedback error={error} success={success} />
        <Button type="submit" pending={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

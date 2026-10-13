"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";

const USER_CREATE_ROLES = ["employee", "customer", "supplier"] as const;

type FormValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleCode: (typeof USER_CREATE_ROLES)[number];
};

export function UserCreateForm() {
  const { post, error, success, pending } = usePost();
  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      roleCode: "employee",
    },
  });
  const roleCode = useWatch({ control: form.control, name: "roleCode" });
  const [visible, setVisible] = useState(false);
  const permissionLabels = (ROLE_PERMISSIONS[roleCode] ?? []).map(
    (code) => PERMISSIONS.find((item) => item[0] === code)?.[1] ?? code,
  );

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post("/api/v1/users", values, {
          redirectTo: "/users",
          successMessage: "User created successfully.",
        }),
      )}
    >
      <Field label="Name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Email" required>
        <input className={controlClass} type="email" required autoComplete="off" {...form.register("email")} />
      </Field>
      <Field label="Phone">
        <input className={controlClass} type="tel" autoComplete="off" {...form.register("phone")} />
      </Field>
      <Field label="Role category" required>
        <select className={controlClass} required {...form.register("roleCode")}>
          {USER_CREATE_ROLES.map((code) => (
            <option key={code} value={code}>
              {ROLE_LABELS[code] ?? code}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Password" required>
        <div className="flex gap-2">
          <input
            className={controlClass}
            type={visible ? "text" : "password"}
            required
            autoComplete="new-password"
            {...form.register("password")}
          />
          <button type="button" className="btn-ghost shrink-0" onClick={() => setVisible((v) => !v)}>
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <div className="md:col-span-2 space-y-3">
        <p className="text-sm text-muted">This role can: {permissionLabels.join(", ") || "—"}.</p>
        {error ? (
          <p className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}
        {success ? (
          <p className="rounded-[10px] border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-sm font-medium text-[var(--success)]">
            {success}
          </p>
        ) : null}
        <Button type="submit" pending={pending}>
          Create user
        </Button>
      </div>
    </form>
  );
}

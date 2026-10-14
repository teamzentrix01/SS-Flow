"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { UserAccountTypeFields, type UserFormOptions } from "@/components/user-account-fields";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { ROLE_LABELS } from "@/lib/permissions";

const USER_ROLES = ["employee", "customer", "supplier"] as const;

type FormValues = {
  name: string;
  phone: string;
  roleCode: (typeof USER_ROLES)[number];
  staffRoleCode: string;
  employeeCode: string;
  designationId: string;
  newDesignation: string;
  departmentId: string;
  shiftId: string;
  customerId: string;
  supplierId: string;
  password: string;
};

export function UserEditForm({
  userId,
  email,
  defaultValues,
  options,
  initialPlantIds,
}: {
  userId: string;
  email: string;
  defaultValues: FormValues;
  options: UserFormOptions;
  initialPlantIds: string[];
}) {
  const { post, error, success, pending } = usePost();
  const [plantIds, setPlantIds] = useState(initialPlantIds);
  const form = useForm<FormValues>({ defaultValues });
  const [visible, setVisible] = useState(false);
  useWatch({ control: form.control, name: "roleCode" });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          `/api/v1/users/${userId}`,
          {
            ...values,
            plantIds: values.roleCode === "employee" ? plantIds : undefined,
            password: values.password || undefined,
            designationId: values.designationId || undefined,
            departmentId: values.departmentId || undefined,
            shiftId: values.shiftId || undefined,
            customerId: values.customerId || undefined,
            supplierId: values.supplierId || undefined,
            newDesignation: values.newDesignation || undefined,
            employeeCode: values.employeeCode || undefined,
          },
          {
            redirectTo: `/users/${userId}`,
            successMessage: "User updated successfully.",
          },
        ),
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
      <Field label="Account type" required>
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
      <UserAccountTypeFields
        control={form.control}
        register={form.register}
        options={options}
        plantIds={plantIds}
        onPlantIdsChange={setPlantIds}
      />
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button type="submit" pending={pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { UserAccountTypeFields, type UserFormOptions } from "@/components/user-account-fields";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { ROLE_LABELS } from "@/lib/permissions";

const USER_CREATE_ROLES = ["employee", "customer", "supplier"] as const;

type FormValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleCode: (typeof USER_CREATE_ROLES)[number];
  staffRoleCode: string;
  employeeCode: string;
  designationId: string;
  newDesignation: string;
  departmentId: string;
  shiftId: string;
  addressLine: string;
};

export function UserCreateForm({ options }: { options: UserFormOptions }) {
  const { post, error, success, pending } = usePost();
  const [plantIds, setPlantIds] = useState<string[]>(options.defaultPlantIds);
  const [visible, setVisible] = useState(false);
  const form = useForm<FormValues>({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      roleCode: "employee",
      staffRoleCode: "operator",
      employeeCode: "",
      designationId: "",
      newDesignation: "",
      departmentId: "",
      shiftId: "",
      addressLine: "",
    },
  });
  useWatch({ control: form.control, name: "roleCode" });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          "/api/v1/users",
          {
            ...values,
            plantIds: values.roleCode === "employee" ? plantIds : undefined,
            designationId: values.designationId || undefined,
            departmentId: values.departmentId || undefined,
            shiftId: values.shiftId || undefined,
            newDesignation: values.newDesignation || undefined,
            employeeCode: values.employeeCode || undefined,
            addressLine: values.roleCode === "supplier" ? values.addressLine || undefined : undefined,
          },
          {
            redirectTo: "/users",
            successMessage: "User created successfully.",
          },
        ),
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
      <Field label="Account type" required>
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
          Create user
        </Button>
      </div>
    </form>
  );
}

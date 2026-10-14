"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { CreateDialog } from "@/components/create-dialog";
import {
  DesignationPicker,
  PlantAccessPicker,
  RoleCheckboxList,
  type DesignationOption,
} from "@/components/employee-rbac-fields";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";

export type EmployeeEditValues = {
  id: string;
  name: string;
  code: string;
  designationId: string;
  skill: string;
  shiftId: string;
  departmentId: string;
  email: string;
  roleIds: string[];
  plantIds: string[];
};

export function EditEmployeeForm({
  employee,
  shifts,
  departments,
  designations,
  plants,
  roles,
  canAssignAdmin,
  redirectTo = "/employees",
}: {
  employee: EmployeeEditValues;
  shifts: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  designations: DesignationOption[];
  plants: { id: string; name: string; code: string }[];
  roles: { id: string; code: string; name: string }[];
  canAssignAdmin?: boolean;
  redirectTo?: string;
}) {
  const { post, error, success, pending } = usePost();
  const [visible, setVisible] = useState(false);
  const [roleIds, setRoleIds] = useState(employee.roleIds);
  const [plantIds, setPlantIds] = useState(employee.plantIds);
  const form = useForm({
    defaultValues: { ...employee, password: "" },
  });
  const hasLogin = employee.roleIds.length > 0 || Boolean(employee.email);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(
          `/api/v1/employees/${employee.id}`,
          {
            ...values,
            roleIds,
            plantIds,
            password: values.password || undefined,
          },
          {
            redirectTo,
            successMessage: "Employee updated successfully.",
          },
        ),
      )}
    >
      <Field label="Name">
        <input className={controlClass} {...form.register("name")} />
      </Field>
      <Field label="Employee ID">
        <input className={controlClass} {...form.register("code")} />
      </Field>
      <Field label="Department">
        <select className={controlClass} {...form.register("departmentId")}>
          <option value="">None</option>
          {departments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Shift">
        <select className={controlClass} {...form.register("shiftId")}>
          <option value="">None</option>
          {shifts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <DesignationPicker control={form.control} designations={designations} register={form.register} />
      <Field label="Machine skill">
        <input className={controlClass} {...form.register("skill")} />
      </Field>
      {hasLogin ? (
        <>
          <Field label="Login email">
            <input className={controlClass} placeholder="Blank keeps the current login" {...form.register("email")} />
          </Field>
          <Field label="New password">
            <div className="flex gap-2">
              <input
                className={controlClass}
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Blank keeps the current password"
                {...form.register("password")}
              />
              <button type="button" className="btn-ghost shrink-0" onClick={() => setVisible((value) => !value)}>
                {visible ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          <PlantAccessPicker plants={plants} value={plantIds} onChange={setPlantIds} />
          <RoleCheckboxList roles={roles} value={roleIds} onChange={setRoleIds} canAssignAdmin={canAssignAdmin} />
        </>
      ) : (
        <p className="md:col-span-2 text-sm text-muted">This employee has no login account. Enable login from create flow or Users.</p>
      )}
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>Save changes</Button>
      </div>
    </form>
  );
}

export function EmployeeActions({
  employee,
  shifts,
  self,
}: {
  employee: EmployeeEditValues;
  shifts: { id: string; name: string }[];
  self: boolean;
}) {
  const { post, error, success, pending } = usePost();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CreateDialog label="Edit" title={`Edit ${employee.code}`}>
        <p className="text-sm text-muted">Open the full edit page for designation and role changes.</p>
        <a href={`/employees/${employee.id}/edit`} className="btn-ghost mt-2 inline-block">
          Go to edit
        </a>
      </CreateDialog>
      {self ? null : (
        <button
          type="button"
          className="h-11 rounded-[10px] border border-[#c43b32] px-3 text-sm font-semibold text-[#c43b32]"
          onClick={() => setConfirm(true)}
        >
          Delete
        </button>
      )}
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#242626]/55 p-3 sm:items-center"
          onMouseDown={() => setConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete employee"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Delete employee?</h2>
            <FormFeedback error={error} />
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                tone="danger"
                pending={pending}
                onClick={async () => {
                  const result = await post(`/api/v1/employees/${employee.id}/delete`, {}, "/employees");
                  if (result) setConfirm(false);
                }}
              >
                Delete
              </Button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

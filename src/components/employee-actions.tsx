"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { CreateDialog } from "@/components/create-dialog";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { PERMISSIONS, ROLE_PERMISSIONS, roleCodesForSelect } from "@/lib/permissions";

const roleChoices = roleCodesForSelect();

export type EmployeeEditValues = {
  id: string;
  name: string;
  code: string;
  designation: string;
  skill: string;
  shiftId: string;
  email: string;
  roleCode: string;
};

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>;
}

export function EditEmployeeForm({
  employee,
  shifts,
  redirectTo = "/employees",
}: {
  employee: EmployeeEditValues;
  shifts: { id: string; name: string }[];
  redirectTo?: string;
}) {
  const { post, error, pending } = usePost();
  const [visible, setVisible] = useState(false);
  const form = useForm({
    defaultValues: { ...employee, password: "" },
  });
  const roleCode = useWatch({ control: form.control, name: "roleCode" });
  const permissionLabels = (ROLE_PERMISSIONS[roleCode] ?? []).map((code) => PERMISSIONS.find((item) => item[0] === code)?.[1] ?? code);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) => post(`/api/v1/employees/${employee.id}`, values, redirectTo))}
    >
      <Field label="Name"><input className={controlClass} {...form.register("name")} /></Field>
      <Field label="Employee ID"><input className={controlClass} {...form.register("code")} /></Field>
      <Field label="Role">
        <select className={controlClass} {...form.register("roleCode")}>
          {roleChoices.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}
        </select>
      </Field>
      <Field label="Shift">
        <select className={controlClass} {...form.register("shiftId")}>
          <option value="">None</option>
          {shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <Field label="Designation"><input className={controlClass} {...form.register("designation")} /></Field>
      <Field label="Machine skill"><input className={controlClass} {...form.register("skill")} /></Field>
      <Field label="Login email"><input className={controlClass} placeholder="Blank keeps the current login" {...form.register("email")} /></Field>
      <Field label="New password">
        <div className="flex gap-2">
          <input className={controlClass} type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Blank keeps the current password" {...form.register("password")} />
          <button type="button" className="btn-ghost shrink-0" onClick={() => setVisible((value) => !value)}>{visible ? "Hide" : "Show"}</button>
        </div>
      </Field>
      <div className="md:col-span-2 space-y-3">
        <p className="text-sm text-muted">This role can: {permissionLabels.join(", ")}.</p>
        <ErrorText error={error} />
        <Button pending={pending}>Save changes</Button>
      </div>
    </form>
  );
}

export function EmployeeActions({ employee, shifts, self }: { employee: EmployeeEditValues; shifts: { id: string; name: string }[]; self: boolean }) {
  const { post, error, pending } = usePost();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CreateDialog label="Edit" title={`Edit ${employee.code}`}>
        <EditEmployeeForm employee={employee} shifts={shifts} />
      </CreateDialog>
      {self ? null : (
        <button type="button" className="h-11 rounded-[10px] border border-[#c43b32] px-3 text-sm font-semibold text-[#c43b32]" onClick={() => setConfirm(true)}>
          Delete
        </button>
      )}
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#242626]/55 p-3 sm:items-center" onMouseDown={() => setConfirm(false)}>
          <div role="dialog" aria-modal="true" aria-label="Delete employee" className="w-full max-w-md rounded-2xl border border-border bg-card p-5" onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-semibold">Delete {employee.name}?</h2>
            <p className="mt-2 text-sm text-muted">This removes the person and their login. Jobs they already worked stay on the board, unassigned.</p>
            <ErrorText error={error} />
            <div className="mt-4 flex gap-2">
              <Button type="button" tone="danger" pending={pending} onClick={async () => { const result = await post(`/api/v1/employees/${employee.id}/delete`, {}, "/employees"); if (result) setConfirm(false); }}>Delete</Button>
              <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

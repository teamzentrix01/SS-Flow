"use client";

import { useForm } from "react-hook-form";
import { FormFeedback } from "@/components/form-feedback";
import { Button, Field, controlClass } from "@/components/ui";
import { usePost } from "@/components/use-post";

type Values = {
  name: string;
  code: string;
  description: string;
  departmentId: string;
  isActive: boolean;
};

export function DesignationForm({
  departments,
  initial,
  redirectTo,
}: {
  departments: { id: string; name: string }[];
  initial?: Partial<Values> & { id?: string };
  redirectTo: string;
}) {
  const { post, error, success, pending } = usePost();
  const form = useForm<Values>({
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "",
      description: initial?.description ?? "",
      departmentId: initial?.departmentId ?? "",
      isActive: initial?.isActive ?? true,
    },
  });
  const isEdit = Boolean(initial?.id);
  return (
    <form
      className="grid gap-3 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        post(isEdit ? `/api/v1/designations/${initial!.id}` : "/api/v1/designations", values, {
          redirectTo,
          successMessage: isEdit ? "Designation updated." : "Designation created.",
        }),
      )}
    >
      <Field label="Name" required>
        <input className={controlClass} required {...form.register("name")} />
      </Field>
      <Field label="Code">
        <input className={controlClass} placeholder="Auto from name if blank" {...form.register("code")} />
      </Field>
      <Field label="Department">
        <select className={controlClass} {...form.register("departmentId")}>
          <option value="">None</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      {isEdit ? (
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" {...form.register("isActive")} />
          Active (inactive designations are hidden from employee assignment)
        </label>
      ) : null}
      <div className="md:col-span-2">
        <Field label="Description">
          <textarea className={controlClass} rows={3} {...form.register("description")} />
        </Field>
      </div>
      <div className="md:col-span-2 space-y-3">
        <FormFeedback error={error} success={success} />
        <Button pending={pending}>{isEdit ? "Save changes" : "Create designation"}</Button>
      </div>
    </form>
  );
}

"use client";

import { useWatch, type Control, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";

export type DesignationOption = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  department?: { name: string } | null;
};

export function DesignationPicker<T extends FieldValues>({
  control,
  designations,
  register,
}: {
  control: Control<T>;
  designations: DesignationOption[];
  register: UseFormRegister<T>;
}) {
  const designationId = useWatch({ control, name: "designationId" as Path<T> });
  const selected = designations.find((d) => d.id === designationId);
  return (
    <>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Designation (HR title)</span>
        <select
          className="h-11 w-full rounded-[10px] border border-border px-3"
          {...register("designationId" as Path<T>)}
        >
          <option value="">None</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <div className="md:col-span-2 rounded-xl border border-border bg-muted/20 p-3 text-sm">
          <p className="font-semibold">{selected.name}</p>
          <p className="text-muted">{selected.code}</p>
          {selected.description ? <p className="mt-1">{selected.description}</p> : null}
          {selected.department ? (
            <p className="mt-1 text-muted">Department hint: {selected.department.name}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Designation is for HR records only. System access is controlled by roles below.
          </p>
        </div>
      ) : null}
    </>
  );
}

export function PlantAccessPicker({
  plants,
  value,
  onChange,
}: {
  plants: { id: string; name: string; code: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="md:col-span-2 space-y-2">
      <p className="text-sm font-medium">Factory access</p>
      <ul className="flex flex-wrap gap-3">
        {plants.map((plant) => {
          const checked = value.includes(plant.id);
          return (
            <li key={plant.id}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    if (event.target.checked) onChange([...value, plant.id]);
                    else onChange(value.filter((id) => id !== plant.id));
                  }}
                />
                {plant.name} ({plant.code})
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RoleCheckboxList({
  roles,
  value,
  onChange,
  canAssignAdmin,
}: {
  roles: { id: string; code: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  canAssignAdmin?: boolean;
}) {
  const visible = roles.filter((r) => r.code !== "admin" || canAssignAdmin);
  return (
    <div className="md:col-span-2 space-y-2">
      <p className="text-sm font-medium">System roles (permissions)</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {visible.map((role) => (
          <li key={role.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.includes(role.id)}
                onChange={(event) => {
                  if (event.target.checked) onChange([...value, role.id]);
                  else onChange(value.filter((id) => id !== role.id));
                }}
              />
              {role.name}
              <span className="text-xs text-muted">({role.code})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useWatch, type Control, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { DesignationPicker, PlantAccessPicker, type DesignationOption } from "@/components/employee-rbac-fields";
import { Field, controlClass } from "@/components/ui";
import { ROLE_LABELS, STAFF_LOGIN_ROLE_CODES } from "@/lib/permissions";

export type UserFormOptions = {
  departments: { id: string; name: string }[];
  designations: DesignationOption[];
  shifts: { id: string; name: string }[];
  plants: { id: string; name: string; code: string }[];
  defaultPlantIds: string[];
};

type AccountFields = {
  roleCode: string;
  staffRoleCode?: string;
  employeeCode?: string;
  designationId?: string;
  newDesignation?: string;
  departmentId?: string;
  shiftId?: string;
  addressLine?: string;
};

export function UserAccountTypeFields<T extends FieldValues & AccountFields>({
  control,
  register,
  options,
  plantIds,
  onPlantIdsChange,
}: {
  control: Control<T>;
  register: UseFormRegister<T>;
  options: UserFormOptions;
  plantIds: string[];
  onPlantIdsChange: (ids: string[]) => void;
}) {
  const roleCode = useWatch({ control, name: "roleCode" as Path<T> });
  const designationId = useWatch({ control, name: "designationId" as Path<T> });
  const selectedDesignation = options.designations.find((d) => d.id === designationId);

  if (roleCode === "supplier") {
    return (
      <div className="md:col-span-2 rounded-xl border border-border bg-muted/15 p-4">
        <p className="mb-3 text-sm font-semibold">Supplier profile</p>
        <p className="mb-4 text-xs text-muted">
          Creates the supplier master record and portal login together so this supplier appears on purchase orders.
        </p>
        <Field label="Address line">
          <input
            className={controlClass}
            placeholder="Street, city, state"
            {...register("addressLine" as Path<T>)}
          />
        </Field>
      </div>
    );
  }

  if (roleCode !== "employee") return null;

  return (
    <>
      <div className="md:col-span-2 rounded-xl border border-border bg-muted/15 p-4">
        <p className="mb-3 text-sm font-semibold">Employee profile</p>
        <p className="mb-4 text-xs text-muted">
          Creates the HR employee record and login in one step. Desk access follows the role you pick below; permission
          tuning comes later.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Employee ID">
            <input
              className={controlClass}
              placeholder="Auto-generated if blank"
              {...register("employeeCode" as Path<T>)}
            />
          </Field>
          <Field label="Desk role" required>
            <select className={controlClass} required {...register("staffRoleCode" as Path<T>)}>
              {STAFF_LOGIN_ROLE_CODES.map((code) => (
                <option key={code} value={code}>
                  {ROLE_LABELS[code] ?? code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select className={controlClass} {...register("departmentId" as Path<T>)}>
              <option value="">None</option>
              {options.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shift">
            <select className={controlClass} {...register("shiftId" as Path<T>)}>
              <option value="">None</option>
              {options.shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <DesignationPicker control={control} designations={options.designations} register={register} />
          <Field label="Or add designation">
            <input
              className={controlClass}
              placeholder="New title if not in the list"
              disabled={Boolean(designationId)}
              {...register("newDesignation" as Path<T>)}
            />
          </Field>
          {selectedDesignation ? (
            <p className="md:col-span-2 text-xs text-muted">Using designation: {selectedDesignation.name}</p>
          ) : null}
          <PlantAccessPicker plants={options.plants} value={plantIds} onChange={onPlantIdsChange} />
        </div>
      </div>
    </>
  );
}

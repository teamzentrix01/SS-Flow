"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { controlClass } from "@/components/ui";
import { STOCK_STATUSES } from "@/modules/inventory/status";
import { PRODUCT_FORMS } from "@/lib/domain/master-entities";
import { labelFor } from "@/lib/format";

export type InventoryFilterOptions = {
  plants: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  materials: { id: string; name: string; code: string }[];
  grades: string[];
  forms?: string[];
  uoms: string[];
};

export type InventoryFilterField =
  | "q"
  | "plant"
  | "category"
  | "material"
  | "grade"
  | "form"
  | "uom"
  | "status"
  | "type"
  | "from"
  | "to"
  | "minAvailable"
  | "maxAvailable"
  | "thickness"
  | "ref";

const DEFAULT_STATUS = STOCK_STATUSES.map((value) => ({ value, label: labelFor(value) }));

export function InventoryFilterBar({
  action,
  fields,
  options,
  statusOptions = DEFAULT_STATUS,
  typeOptions = [],
  searchPlaceholder = "Search name, code, or batch",
}: {
  action: string;
  fields: InventoryFilterField[];
  options: InventoryFilterOptions;
  statusOptions?: { value: string; label: string }[];
  typeOptions?: { value: string; label: string }[];
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlQuery = params.get("q") ?? "";

  function push(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  }

  function onSearch(value: string) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update("q", value.trim()), 300);
  }

  const active = fields
    .map((field) => {
      const value = params.get(field);
      return value ? { field, value } : null;
    })
    .filter((row): row is { field: InventoryFilterField; value: string } => Boolean(row));

  const fieldClass = "grid gap-1 text-sm";
  const selectClass = `${controlClass} h-10`;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {fields.includes("q") ? (
          <label className={`${fieldClass} md:col-span-2`}>
            <span className="font-medium">Search</span>
            <input
              key={urlQuery}
              className={selectClass}
              defaultValue={urlQuery}
              placeholder={searchPlaceholder}
              onChange={(event) => onSearch(event.target.value)}
            />
          </label>
        ) : null}
        {fields.includes("plant") ? (
          <label className={fieldClass}>
            <span className="font-medium">Factory</span>
            <select className={selectClass} value={params.get("plant") ?? ""} onChange={(e) => update("plant", e.target.value)}>
              <option value="">All factories</option>
              {options.plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("category") ? (
          <label className={fieldClass}>
            <span className="font-medium">Category</span>
            <select className={selectClass} value={params.get("category") ?? ""} onChange={(e) => update("category", e.target.value)}>
              <option value="">All categories</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("material") ? (
          <label className={fieldClass}>
            <span className="font-medium">Material</span>
            <select className={selectClass} value={params.get("material") ?? ""} onChange={(e) => update("material", e.target.value)}>
              <option value="">All materials</option>
              {options.materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.code})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("grade") ? (
          <label className={fieldClass}>
            <span className="font-medium">Grade</span>
            <select className={selectClass} value={params.get("grade") ?? ""} onChange={(e) => update("grade", e.target.value)}>
              <option value="">All grades</option>
              {options.grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("form") ? (
          <label className={fieldClass}>
            <span className="font-medium">Product form</span>
            <select className={selectClass} value={params.get("form") ?? ""} onChange={(e) => update("form", e.target.value)}>
              <option value="">All forms</option>
              {(options.forms?.length ? options.forms : PRODUCT_FORMS).map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("uom") ? (
          <label className={fieldClass}>
            <span className="font-medium">Unit</span>
            <select className={selectClass} value={params.get("uom") ?? ""} onChange={(e) => update("uom", e.target.value)}>
              <option value="">All units</option>
              {options.uoms.map((uom) => (
                <option key={uom} value={uom}>
                  {uom}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("status") ? (
          <label className={fieldClass}>
            <span className="font-medium">Status</span>
            <select className={selectClass} value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("type") ? (
          <label className={fieldClass}>
            <span className="font-medium">Movement type</span>
            <select className={selectClass} value={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)}>
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {fields.includes("from") ? (
          <label className={fieldClass}>
            <span className="font-medium">From</span>
            <input type="date" className={selectClass} value={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} />
          </label>
        ) : null}
        {fields.includes("to") ? (
          <label className={fieldClass}>
            <span className="font-medium">To</span>
            <input type="date" className={selectClass} value={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} />
          </label>
        ) : null}
        {fields.includes("minAvailable") ? (
          <label className={fieldClass}>
            <span className="font-medium">Min available</span>
            <input className={selectClass} defaultValue={params.get("minAvailable") ?? ""} onBlur={(e) => update("minAvailable", e.target.value.trim())} inputMode="decimal" />
          </label>
        ) : null}
        {fields.includes("maxAvailable") ? (
          <label className={fieldClass}>
            <span className="font-medium">Max available</span>
            <input className={selectClass} defaultValue={params.get("maxAvailable") ?? ""} onBlur={(e) => update("maxAvailable", e.target.value.trim())} inputMode="decimal" />
          </label>
        ) : null}
        {fields.includes("thickness") ? (
          <label className={fieldClass}>
            <span className="font-medium">Thickness</span>
            <input className={selectClass} defaultValue={params.get("thickness") ?? ""} onBlur={(e) => update("thickness", e.target.value.trim())} inputMode="decimal" />
          </label>
        ) : null}
        {fields.includes("ref") ? (
          <label className={fieldClass}>
            <span className="font-medium">Reference</span>
            <input className={selectClass} defaultValue={params.get("ref") ?? ""} onBlur={(e) => update("ref", e.target.value.trim())} />
          </label>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {active.length ? (
          <p className="text-sm text-muted">
            {active.length} filter{active.length === 1 ? "" : "s"} active
          </p>
        ) : (
          <p className="text-sm text-muted">No filters applied</p>
        )}
        <Link href={action} className="text-sm font-medium text-accent underline">
          Clear filters
        </Link>
      </div>
    </div>
  );
}

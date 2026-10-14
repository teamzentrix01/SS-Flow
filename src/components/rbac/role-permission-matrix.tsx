"use client";

import { PERMISSION_MODULES } from "@/lib/rbac/permission-catalog";

export type PermissionRow = { code: string; name: string; module: string; description?: string | null };

export function RolePermissionMatrix({
  permissions,
  value,
  onChange,
  disabled,
}: {
  permissions: PermissionRow[];
  value: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);
  const byModule = new Map<string, PermissionRow[]>();
  for (const mod of PERMISSION_MODULES) byModule.set(mod, []);
  for (const perm of permissions) {
    const list = byModule.get(perm.module) ?? [];
    list.push(perm);
    byModule.set(perm.module, list);
  }
  const allCodes = permissions.map((p) => p.code);

  function toggle(code: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(code);
    else next.delete(code);
    onChange([...next]);
  }

  function setModule(module: string, checked: boolean) {
    const codes = byModule.get(module)?.map((p) => p.code) ?? [];
    const next = new Set(selected);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    onChange([...next]);
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={disabled}
          onClick={() => onChange([...allCodes])}
        >
          Select all permissions
        </button>
        <button type="button" className="btn-ghost text-sm" disabled={disabled} onClick={() => onChange([])}>
          Clear all
        </button>
      </div>
      {PERMISSION_MODULES.map((module) => {
        const rows = byModule.get(module) ?? [];
        if (rows.length === 0) return null;
        const moduleCodes = rows.map((r) => r.code);
        const allOn = moduleCodes.every((c) => selected.has(c));
        const someOn = moduleCodes.some((c) => selected.has(c));
        return (
          <fieldset key={module} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-semibold">{module}</legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={disabled}
                  onClick={() => setModule(module, true)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  disabled={disabled}
                  onClick={() => setModule(module, false)}
                >
                  Clear
                </button>
                <span className="text-xs text-muted">
                  {someOn && !allOn ? "Partial" : allOn ? "All" : "None"}
                </span>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {rows.map((perm) => (
                <li key={perm.code}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={disabled}
                      checked={selected.has(perm.code)}
                      onChange={(event) => toggle(perm.code, event.target.checked)}
                    />
                    <span>
                      <span className="font-medium">{perm.name}</span>
                      <span className="block text-xs text-muted">{perm.code}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

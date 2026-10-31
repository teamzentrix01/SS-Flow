"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { usePost } from "@/components/use-post";
import type { SpecOptionItem } from "@/modules/masters/spec-options";

export function SpecOptionsMasterTable({
  initialItems,
}: {
  initialItems: SpecOptionItem[];
}) {
  const router = useRouter();
  const { post, pending } = usePost();

  const [items, setItems] = useState<SpecOptionItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState<string>("all");

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newField, setNewField] = useState("thickness");
  const [newValue, setNewValue] = useState("");
  const [newUnit, setNewUnit] = useState("mm");
  const [newDesc, setNewDesc] = useState("");
  const [createError, setCreateError] = useState("");

  const distinctFields = Array.from(new Set(items.map((i) => i.fieldName))).sort();

  const visibleItems = items.filter((item) => {
    const matchesField = selectedField === "all" || item.fieldName === selectedField;
    const matchesSearch = `${item.fieldName} ${item.value} ${item.unit ?? ""} ${item.description ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matchesField && matchesSearch;
  });

  const handleCreate = async () => {
    setCreateError("");
    if (!newValue.trim()) {
      setCreateError("Value is required.");
      return;
    }

    try {
      const res = await post<{ option: SpecOptionItem }>(
        "/api/v1/masters/spec-options",
        {
          fieldName: newField,
          value: newValue.trim(),
          unit: newUnit.trim() || undefined,
          description: newDesc.trim() || undefined,
        },
        { silent: true, successMessage: "Specification option saved." }
      );

      if (res?.option) {
        setItems((prev) => [res.option, ...prev]);
        setCreateOpen(false);
        setNewValue("");
        setNewDesc("");
        router.refresh();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create specification option.");
    }
  };

  const handleToggleActive = async (item: SpecOptionItem) => {
    try {
      const res = await fetch(`/api/v1/masters/spec-options/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isActive: !i.isActive } : i))
        );
        router.refresh();
      }
    } catch {
      // ignore
    }
  };

  const inputClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 sm:max-w-md">
          <input
            className={`${inputClass} flex-1`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search specification values…"
            aria-label="Search specifications"
          />
          <select
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
          >
            <option value="all">All Fields</option>
            {distinctFields.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 h-10 px-4 text-sm"
          onClick={() => {
            setCreateError("");
            setNewValue("");
            setNewDesc("");
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Specification Option
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleItems.map((item) => (
              <tr key={item.id} className="hover:bg-muted/10 transition">
                <td className="px-4 py-3 font-semibold text-[var(--ink)] capitalize">
                  {item.fieldName}
                </td>
                <td className="px-4 py-3 font-medium text-[var(--ink)]">
                  {item.value}
                </td>
                <td className="px-4 py-3 text-muted">{item.unit || "—"}</td>
                <td className="px-4 py-3 text-muted">{item.description || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className={`h-8 px-2 text-xs hover:underline ${
                      item.isActive ? "text-amber-700" : "text-emerald-700"
                    }`}
                    onClick={() => void handleToggleActive(item)}
                  >
                    {item.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleItems.length ? (
          <p className="p-6 text-center text-sm text-muted">
            No specification options match your search.
          </p>
        ) : null}
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">
              Add New Specification Option
            </h3>
            <p className="text-xs text-muted">
              Add a permanent specification option (e.g. thickness, diameter, width).
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Field *</label>
                <select
                  className={`${inputClass} mt-1`}
                  value={newField}
                  onChange={(e) => {
                    setNewField(e.target.value);
                    if (["thickness", "diameter", "width", "length"].includes(e.target.value)) {
                      setNewUnit("mm");
                    } else {
                      setNewUnit("");
                    }
                  }}
                >
                  <option value="thickness">Thickness</option>
                  <option value="diameter">Diameter</option>
                  <option value="width">Width</option>
                  <option value="length">Length</option>
                  <option value="pvdColour">PVD Colour</option>
                  <option value="size">Size</option>
                  <option value="wireGauge">Wire Gauge</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Value *</label>
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. 1.25, 300, Gold"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Unit (optional)</label>
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. mm"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Description (optional)</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  placeholder="Optional standard or application notes…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
            </div>

            {createError ? <p className="text-xs text-danger">{createError}</p> : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary h-9 px-4 text-sm"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className="btn-primary h-9 px-4 text-sm"
                onClick={() => void handleCreate()}
              >
                Save Option
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Check, X } from "lucide-react";
import { usePost } from "@/components/use-post";
import type { GradeMasterItem } from "@/modules/masters/grades-finishes";

type ProductOption = { id: string; name: string; sku: string };

export function GradeMasterTable({
  grades: initialGrades,
  products,
}: {
  grades: GradeMasterItem[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const { post, pending, error } = usePost();

  const [grades, setGrades] = useState<GradeMasterItem[]>(initialGrades);
  const [search, setSearch] = useState("");

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [createError, setCreateError] = useState("");

  // Edit Modal
  const [editingGrade, setEditingGrade] = useState<GradeMasterItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState("");

  // Manage Compatibility Modal
  const [compatGrade, setCompatGrade] = useState<GradeMasterItem | null>(null);
  const [addCompatProductId, setAddCompatProductId] = useState("");

  const visibleGrades = grades.filter((g) =>
    `${g.name} ${g.normalizedName} ${g.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleCreate = async () => {
    setCreateError("");
    if (!newName.trim()) {
      setCreateError("Grade name is required.");
      return;
    }

    try {
      const res = await post<{ grade: { id: string; name: string; normalizedName: string; description: string | null; isActive: boolean } }>(
        "/api/v1/masters/grades",
        {
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          productId: selectedProductId || undefined,
        },
        { silent: true, successMessage: "Grade saved." }
      );

      if (res?.grade) {
        setCreateOpen(false);
        setNewName("");
        setNewDesc("");
        setSelectedProductId("");
        router.refresh();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create grade.");
    }
  };

  const handleUpdate = async () => {
    if (!editingGrade) return;
    setEditError("");
    if (!editName.trim()) {
      setEditError("Grade name is required.");
      return;
    }

    try {
      const response = await fetch(`/api/v1/masters/grades/${editingGrade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          isActive: editActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to update grade.");
      }

      setEditingGrade(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update grade.");
    }
  };

  const handleToggleProduct = async (gradeId: string, productId: string, isActive: boolean) => {
    try {
      await post(
        `/api/v1/masters/catalog-products/${productId}/compatibility`,
        {
          productId,
          masterId: gradeId,
          type: "grade",
          isActive,
        },
        { silent: true, successMessage: isActive ? "Product associated." : "Product removed from compatibility." }
      );
      router.refresh();
    } catch {
      // Handled by usePost
    }
  };

  const inputClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm sm:max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search grades by name or description…"
          aria-label="Search grades"
        />
        <button
          type="button"
          className="btn-primary inline-flex items-center gap-2 h-10 px-4 text-sm"
          onClick={() => {
            setCreateError("");
            setNewName("");
            setNewDesc("");
            setSelectedProductId("");
            setCreateOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Grade
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Grade Name</th>
              <th className="px-4 py-3">Normalized Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Compatible Products</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleGrades.map((grade) => (
              <tr key={grade.id} className="hover:bg-muted/10 transition">
                <td className="px-4 py-3 font-semibold text-[var(--ink)]">{grade.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{grade.normalizedName}</td>
                <td className="px-4 py-3 text-muted">{grade.description || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      grade.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {grade.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {grade.compatibleProducts.length ? (
                      grade.compatibleProducts.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--ink-muted)] border border-border"
                        >
                          {p.name}
                          <button
                            type="button"
                            title={`Remove ${p.name}`}
                            className="text-muted hover:text-danger ml-0.5"
                            onClick={() => void handleToggleProduct(grade.id, p.id, false)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted">No products associated</span>
                    )}
                    <button
                      type="button"
                      className="text-xs text-[var(--accent)] hover:underline ml-1"
                      onClick={() => {
                        setCompatGrade(grade);
                        setAddCompatProductId("");
                      }}
                    >
                      + Associate
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    className="btn-ghost h-8 px-2 text-xs text-[var(--accent)] hover:underline mr-2"
                    onClick={() => {
                      setEditingGrade(grade);
                      setEditName(grade.name);
                      setEditDesc(grade.description ?? "");
                      setEditActive(grade.isActive);
                      setEditError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`h-8 px-2 text-xs hover:underline ${grade.isActive ? "text-amber-700" : "text-emerald-700"}`}
                    onClick={async () => {
                      try {
                        await fetch(`/api/v1/masters/grades/${grade.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !grade.isActive }),
                        });
                        router.refresh();
                      } catch {}
                    }}
                  >
                    {grade.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleGrades.length ? (
          <p className="p-6 text-center text-sm text-muted">No grades match your search.</p>
        ) : null}
      </div>

      {/* Create Modal */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">Add New Grade</h3>
            <p className="text-xs text-muted">
              Add a permanent grade record. It will be validated for uniqueness to prevent duplicates.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Grade name *</label>
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. SS 304, SS 316L, SS 202"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Description (optional)</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  placeholder="Material properties, standard specification details…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Associate with product (optional)</label>
                <select
                  className={`${inputClass} mt-1`}
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">None (manage compatibility later)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
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
                Save Grade
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Modal */}
      {editingGrade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">Edit Grade</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Grade name *</label>
                <input
                  className={`${inputClass} mt-1`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Description</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="grade-active-check"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="grade-active-check" className="text-sm font-medium text-[var(--ink)]">
                  Active in catalog
                </label>
              </div>
            </div>
            {editError ? <p className="text-xs text-danger">{editError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary h-9 px-4 text-sm"
                onClick={() => setEditingGrade(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary h-9 px-4 text-sm"
                onClick={() => void handleUpdate()}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Associate Product Compatibility Modal */}
      {compatGrade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">
              Associate Grade &ldquo;{compatGrade.name}&rdquo;
            </h3>
            <p className="text-xs text-muted">
              Choose an existing parent product to permit this grade for.
            </p>
            <div>
              <label className="text-xs font-medium text-[var(--ink)]">Select product</label>
              <select
                className={`${inputClass} mt-1`}
                value={addCompatProductId}
                onChange={(e) => setAddCompatProductId(e.target.value)}
              >
                <option value="">Choose a product…</option>
                {products
                  .filter((p) => !compatGrade.compatibleProducts.some((cp) => cp.id === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary h-9 px-4 text-sm"
                onClick={() => setCompatGrade(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!addCompatProductId || pending}
                className="btn-primary h-9 px-4 text-sm"
                onClick={async () => {
                  if (!addCompatProductId) return;
                  await handleToggleProduct(compatGrade.id, addCompatProductId, true);
                  setCompatGrade(null);
                }}
              >
                Add Association
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

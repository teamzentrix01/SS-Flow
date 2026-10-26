"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { usePost } from "@/components/use-post";
import type { FinishMasterItem } from "@/modules/masters/grades-finishes";

type ProductOption = { id: string; name: string; sku: string };

export function FinishMasterTable({
  finishes: initialFinishes,
  products,
}: {
  finishes: FinishMasterItem[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const { post, pending } = usePost();

  const [finishes, setFinishes] = useState<FinishMasterItem[]>(initialFinishes);
  const [search, setSearch] = useState("");

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [createError, setCreateError] = useState("");

  // Edit Modal
  const [editingFinish, setEditingFinish] = useState<FinishMasterItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState("");

  // Manage Compatibility Modal
  const [compatFinish, setCompatFinish] = useState<FinishMasterItem | null>(null);
  const [addCompatProductId, setAddCompatProductId] = useState("");

  const visibleFinishes = finishes.filter((f) =>
    `${f.name} ${f.normalizedName} ${f.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const handleCreate = async () => {
    setCreateError("");
    if (!newName.trim()) {
      setCreateError("Finish name is required.");
      return;
    }

    try {
      const res = await post<{ finish: { id: string; name: string; normalizedName: string; description: string | null; isActive: boolean } }>(
        "/api/v1/masters/finishes",
        {
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          productId: selectedProductId || undefined,
        },
        { silent: true, successMessage: "Finish saved." }
      );

      if (res?.finish) {
        setCreateOpen(false);
        setNewName("");
        setNewDesc("");
        setSelectedProductId("");
        router.refresh();
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create finish.");
    }
  };

  const handleUpdate = async () => {
    if (!editingFinish) return;
    setEditError("");
    if (!editName.trim()) {
      setEditError("Finish name is required.");
      return;
    }

    try {
      const response = await fetch(`/api/v1/masters/finishes/${editingFinish.id}`, {
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
        throw new Error(data.error?.message || "Failed to update finish.");
      }

      setEditingFinish(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update finish.");
    }
  };

  const handleToggleProduct = async (finishId: string, productId: string, isActive: boolean) => {
    try {
      await post(
        `/api/v1/masters/catalog-products/${productId}/compatibility`,
        {
          productId,
          masterId: finishId,
          type: "finish",
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
          placeholder="Search finishes by name or description…"
          aria-label="Search finishes"
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
          Add Finish
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/20 text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Finish Name</th>
              <th className="px-4 py-3">Normalized Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Compatible Products</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleFinishes.map((finish) => (
              <tr key={finish.id} className="hover:bg-muted/10 transition">
                <td className="px-4 py-3 font-semibold text-[var(--ink)]">{finish.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{finish.normalizedName}</td>
                <td className="px-4 py-3 text-muted">{finish.description || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      finish.isActive
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {finish.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {finish.compatibleProducts.length ? (
                      finish.compatibleProducts.map((p) => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 rounded bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--ink-muted)] border border-border"
                        >
                          {p.name}
                          <button
                            type="button"
                            title={`Remove ${p.name}`}
                            className="text-muted hover:text-danger ml-0.5"
                            onClick={() => void handleToggleProduct(finish.id, p.id, false)}
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
                        setCompatFinish(finish);
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
                      setEditingFinish(finish);
                      setEditName(finish.name);
                      setEditDesc(finish.description ?? "");
                      setEditActive(finish.isActive);
                      setEditError("");
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`h-8 px-2 text-xs hover:underline ${finish.isActive ? "text-amber-700" : "text-emerald-700"}`}
                    onClick={async () => {
                      try {
                        await fetch(`/api/v1/masters/finishes/${finish.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !finish.isActive }),
                        });
                        router.refresh();
                      } catch {}
                    }}
                  >
                    {finish.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleFinishes.length ? (
          <p className="p-6 text-center text-sm text-muted">No finishes match your search.</p>
        ) : null}
      </div>

      {/* Create Modal */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">Add New Finish</h3>
            <p className="text-xs text-muted">
              Add a permanent finish record. It will be validated for uniqueness to prevent duplicates.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Finish name *</label>
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. 2B, BA, No. 4, Mirror, Matt, PVD"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Description (optional)</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  placeholder="Surface texture, roughness Ra, appearance specifications…"
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
                Save Finish
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Modal */}
      {editingFinish ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">Edit Finish</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ink)]">Finish name *</label>
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
                  id="finish-active-check"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="finish-active-check" className="text-sm font-medium text-[var(--ink)]">
                  Active in catalog
                </label>
              </div>
            </div>
            {editError ? <p className="text-xs text-danger">{editError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary h-9 px-4 text-sm"
                onClick={() => setEditingFinish(null)}
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
      {compatFinish ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">
              Associate Finish &ldquo;{compatFinish.name}&rdquo;
            </h3>
            <p className="text-xs text-muted">
              Choose an existing parent product to permit this finish for.
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
                  .filter((p) => !compatFinish.compatibleProducts.some((cp) => cp.id === p.id))
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
                onClick={() => setCompatFinish(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!addCompatProductId || pending}
                className="btn-primary h-9 px-4 text-sm"
                onClick={async () => {
                  if (!addCompatProductId) return;
                  await handleToggleProduct(compatFinish.id, addCompatProductId, true);
                  setCompatFinish(null);
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

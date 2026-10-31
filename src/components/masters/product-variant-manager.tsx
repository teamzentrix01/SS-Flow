"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePost } from "@/components/use-post";
import { CreatableSpecSelect } from "@/components/ui/creatable-spec-select";

type Variant = {
  id: string; sku: string; displayName: string | null; grade: string | null; finish: string | null;
  thicknessMm: string | null; widthMm: string | null; lengthMm: string | null; diameterMm: string | null;
  isActive: boolean; unit: { symbol: string } | null;
  attributes: Record<string, unknown>;
};

type OptionItem = { id: string; name: string };

export function ProductVariantManager({
  productId,
  productName,
  variants,
  units,
  compatibleGrades: initialGrades = [],
  compatibleFinishes: initialFinishes = [],
}: {
  productId: string;
  productName?: string;
  variants: Variant[];
  units: string[];
  compatibleGrades?: OptionItem[];
  compatibleFinishes?: OptionItem[];
}) {
  const router = useRouter();
  const { post, pending, error } = usePost();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [extraSpecs, setExtraSpecs] = useState("");
  const [search, setSearch] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const [grades, setGrades] = useState<OptionItem[]>(initialGrades);
  const [finishes, setFinishes] = useState<OptionItem[]>(initialFinishes);

  // Quick-Add Modal States
  const [modalType, setModalType] = useState<"grade" | "finish" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickPending, setQuickPending] = useState(false);

  const visibleVariants = variants.filter((variant) => `${variant.sku} ${variant.displayName ?? ""} ${variant.grade ?? ""} ${variant.finish ?? ""} ${variant.thicknessMm ?? ""} ${variant.widthMm ?? ""} ${variant.lengthMm ?? ""} ${variant.diameterMm ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const blank = { displayName: "", grade: "", finish: "", thickness: "", width: "", length: "", diameter: "", uom: units[0] ?? "" };

  const begin = (variant?: Variant) => {
    setEditing(variant?.id ?? "new");
    const reserved = new Set(["grade", "finish", "thickness", "width", "length", "diameter"]);
    setExtraSpecs(variant ? Object.entries(variant.attributes).filter(([key, value]) => !reserved.has(key) && (typeof value === "string" || typeof value === "number")).map(([key, value]) => `${key}=${String(value)}`).join("\n") : "");
    setDraft(variant ? {
      displayName: variant.displayName ?? "", grade: variant.grade ?? "", finish: variant.finish ?? "",
      thickness: variant.thicknessMm ?? "", width: variant.widthMm ?? "", length: variant.lengthMm ?? "",
      diameter: variant.diameterMm ?? "", uom: variant.unit?.symbol ?? units[0] ?? "",
    } : blank);
  };

  const handleQuickAdd = async () => {
    setQuickError("");
    if (!quickName.trim()) {
      setQuickError(`${modalType === "grade" ? "Grade" : "Finish"} name is required.`);
      return;
    }
    setQuickPending(true);
    try {
      if (modalType === "grade") {
        const res = await post<{ grade: { id: string; name: string } }>(
          "/api/v1/masters/grades",
          { productId, name: quickName.trim(), description: quickDesc.trim() || undefined },
          { silent: true, successMessage: "Grade added and associated." }
        );
        if (res?.grade) {
          setGrades((prev) => (prev.some((g) => g.id === res.grade.id) ? prev : [...prev, { id: res.grade.id, name: res.grade.name }]));
          setDraft((prev) => ({ ...prev, grade: res.grade.name }));
          setModalType(null);
          setQuickName("");
          setQuickDesc("");
        }
      } else if (modalType === "finish") {
        const res = await post<{ finish: { id: string; name: string } }>(
          "/api/v1/masters/finishes",
          { productId, name: quickName.trim(), description: quickDesc.trim() || undefined },
          { silent: true, successMessage: "Finish added and associated." }
        );
        if (res?.finish) {
          setFinishes((prev) => (prev.some((f) => f.id === res.finish.id) ? prev : [...prev, { id: res.finish.id, name: res.finish.name }]));
          setDraft((prev) => ({ ...prev, finish: res.finish.name }));
          setModalType(null);
          setQuickName("");
          setQuickDesc("");
        }
      }
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setQuickPending(false);
    }
  };

  const save = async (id?: string) => {
    setLocalError(null);
    const attributes: Record<string, string> = {};
    for (const entry of extraSpecs.split("\n").map((line) => line.trim()).filter(Boolean)) {
      const split = entry.indexOf("=");
      if (split < 1) { setLocalError("Enter additional specifications as field=value, one per line."); return; }
      const key = entry.slice(0, split).trim(); const value = entry.slice(split + 1).trim();
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !value || key in attributes) { setLocalError("Specification names must be unique and use letters, numbers, and underscores."); return; }
      attributes[key] = value;
    }
    const normalized = (value?: string | null) => value?.trim().toLocaleLowerCase() ?? "";
    const numeric = (value?: string | null) => Number(value || 0);
    const duplicate = variants.find((variant) => variant.id !== id && variant.isActive &&
      normalized(variant.grade) === normalized(draft.grade) && normalized(variant.finish) === normalized(draft.finish) &&
      numeric(variant.thicknessMm) === numeric(draft.thickness) && numeric(variant.widthMm) === numeric(draft.width) &&
      numeric(variant.lengthMm) === numeric(draft.length) && numeric(variant.diameterMm) === numeric(draft.diameter));
    if (duplicate) { setLocalError("An active variant with these specifications already exists."); return; }
    const result = await post(`/api/v1/masters/catalog-products/${productId}/variants`, {
      ...(id ? { id } : {}), ...draft,
      attributes,
    }, { silent: true, successMessage: id ? "Variant updated." : "Variant added." });
    if (result) { setEditing(null); router.refresh(); }
  };

  const deactivate = async (variant: Variant) => {
    const result = await post(`/api/v1/masters/catalog-products/${productId}/variants`, {
      id: variant.id, isActive: !variant.isActive,
      displayName: variant.displayName ?? "", grade: variant.grade ?? "", finish: variant.finish ?? "",
      thickness: variant.thicknessMm ?? "", width: variant.widthMm ?? "", length: variant.lengthMm ?? "",
      diameter: variant.diameterMm ?? "", uom: variant.unit?.symbol ?? units[0] ?? "",
      attributes: Object.fromEntries(Object.entries(variant.attributes).filter(([key, value]) => !["grade", "finish", "thickness", "width", "length", "diameter"].includes(key) && (typeof value === "string" || typeof value === "number")).map(([key, value]) => [key, String(value)])),
    }, { silent: true, successMessage: variant.isActive ? "Variant deactivated." : "Variant activated." });
    if (result) router.refresh();
  };

  const inputClass = "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";
  const editor = (id?: string) => (
    <div className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs font-medium text-muted">
        Display name (optional)
        <input className={`${inputClass} mt-1`} value={draft.displayName ?? ""} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="Auto-generated if empty" />
      </label>

      <label className="text-xs font-medium text-muted">
        Grade
        <CreatableSpecSelect
          fieldName="grade"
          fieldLabel="Grade"
          value={draft.grade ?? ""}
          onChange={(val) => setDraft({ ...draft, grade: val })}
          options={grades.map((g) => g.name)}
          productId={productId}
          placeholder="Select or add grade…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">
        Finish
        <CreatableSpecSelect
          fieldName="finish"
          fieldLabel="Finish"
          value={draft.finish ?? ""}
          onChange={(val) => setDraft({ ...draft, finish: val })}
          options={finishes.map((f) => f.name)}
          productId={productId}
          placeholder="Select or add finish…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">
        Thickness (mm)
        <CreatableSpecSelect
          fieldName="thickness"
          fieldLabel="Thickness"
          unit="mm"
          value={draft.thickness ?? ""}
          onChange={(val) => setDraft({ ...draft, thickness: val })}
          options={Array.from(new Set(variants.map((v) => v.thicknessMm).filter(Boolean) as string[]))}
          productId={productId}
          placeholder="Select or add thickness…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">
        Diameter (mm)
        <CreatableSpecSelect
          fieldName="diameter"
          fieldLabel="Diameter"
          unit="mm"
          value={draft.diameter ?? ""}
          onChange={(val) => setDraft({ ...draft, diameter: val })}
          options={Array.from(new Set(variants.map((v) => v.diameterMm).filter(Boolean) as string[]))}
          productId={productId}
          placeholder="Select or add diameter…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">
        Width (mm)
        <CreatableSpecSelect
          fieldName="width"
          fieldLabel="Width"
          unit="mm"
          value={draft.width ?? ""}
          onChange={(val) => setDraft({ ...draft, width: val })}
          options={Array.from(new Set(variants.map((v) => v.widthMm).filter(Boolean) as string[]))}
          productId={productId}
          placeholder="Select or add width…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">
        Length (mm)
        <CreatableSpecSelect
          fieldName="length"
          fieldLabel="Length"
          unit="mm"
          value={draft.length ?? ""}
          onChange={(val) => setDraft({ ...draft, length: val })}
          options={Array.from(new Set(variants.map((v) => v.lengthMm).filter(Boolean) as string[]))}
          productId={productId}
          placeholder="Select or add length…"
          className="mt-1"
        />
      </label>

      <label className="text-xs font-medium text-muted">Unit of measure<select className={`${inputClass} mt-1`} value={draft.uom ?? ""} onChange={(event) => setDraft({ ...draft, uom: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <label className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-4">Additional product specifications<textarea className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={extraSpecs} onChange={(event) => setExtraSpecs(event.target.value)} placeholder="capacityLitres=2.5&#10;materialFamily=stainless steel" /><span className="mt-1 block font-normal">Enter optional product-specific fields as field=value, one per line.</span></label>
      <div className="flex items-end gap-2"><button type="button" disabled={pending} className="btn-primary h-10 px-4" onClick={() => void save(id)}>{id ? "Save variant" : "Add variant"}</button><button type="button" className="btn-secondary h-10 px-4" onClick={() => setEditing(null)}>Cancel</button></div>
      {localError || error ? <p className="sm:col-span-2 lg:col-span-4 text-sm text-danger">{localError || error}</p> : null}
    </div>
  );

  return <section className="mt-6">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Product Variants / Specifications</h2><button type="button" className="btn-secondary h-9 px-3 text-sm" onClick={() => begin()}>Add variant</button></div>
    {variants.length ? (
      <>
        <input
          className="mb-2 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm sm:max-w-sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search variant specifications"
          aria-label="Search variants"
        />
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/10 text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Finish</th>
                <th className="px-3 py-2">Thickness</th>
                <th className="px-3 py-2">Width</th>
                <th className="px-3 py-2">Length</th>
                <th className="px-3 py-2">UOM</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleVariants.map((variant) => {
                const cleanName = variant.displayName?.includes(" · ")
                  ? variant.displayName.split(" · ")[0].trim()
                  : (variant.displayName?.trim() || productName || "—");

                return (
                  <tr key={variant.id} className="border-t border-border hover:bg-muted/5 transition-colors">
                    <td className="px-3 py-2 font-medium text-[var(--ink)]">
                      {cleanName}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted whitespace-nowrap">
                      {variant.sku}
                    </td>
                    <td className="px-3 py-2">{variant.grade || "—"}</td>
                    <td className="px-3 py-2">{variant.finish || "—"}</td>
                    <td className="px-3 py-2">{variant.thicknessMm ? `${variant.thicknessMm} mm` : "—"}</td>
                    <td className="px-3 py-2">{variant.widthMm ? `${variant.widthMm} mm` : "—"}</td>
                    <td className="px-3 py-2">{variant.lengthMm ? `${variant.lengthMm} mm` : "—"}</td>
                    <td className="px-3 py-2">{variant.unit?.symbol || "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          variant.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {variant.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-3 text-accent hover:underline font-medium"
                        onClick={() => begin(variant)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="text-muted hover:text-danger hover:underline"
                        onClick={() => void deactivate(variant)}
                      >
                        {variant.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleVariants.length ? <p className="p-4 text-sm text-muted">No variants match this search.</p> : null}
        </div>
      </>
    ) : (
      <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
        No variants yet. Add specifications to create another stock SKU.
      </p>
    )}
    {editing === "new" ? editor() : null}
    {editing && editing !== "new" ? editor(editing) : null}

    {/* Quick-Add Modal */}
    {modalType ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-semibold text-[var(--ink)]">
            {modalType === "grade" ? "Add New Grade" : "Add New Finish"}
          </h3>
          <p className="text-xs text-muted">
            Creates a permanent {modalType} in the master catalog and associates it with this product. If it already exists, the record is safely reused.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-[var(--ink)]">
                {modalType === "grade" ? "Grade Name *" : "Finish Name *"}
              </label>
              <input
                className={`${inputClass} mt-1`}
                placeholder={modalType === "grade" ? "e.g. SS 304, SS 316L, SS 202" : "e.g. 2B, BA, No. 4, Mirror"}
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--ink)]">Description (optional)</label>
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                placeholder="Specification details, standards…"
                value={quickDesc}
                onChange={(e) => setQuickDesc(e.target.value)}
              />
            </div>
          </div>
          {quickError ? <p className="text-xs text-danger">{quickError}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary h-9 px-4 text-sm"
              onClick={() => setModalType(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={quickPending}
              className="btn-primary h-9 px-4 text-sm"
              onClick={() => void handleQuickAdd()}
            >
              {quickPending ? "Saving…" : "Save & Associate"}
            </button>
          </div>
        </div>
      </div>
    ) : null}
  </section>;
}

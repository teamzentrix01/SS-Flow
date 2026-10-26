"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePost } from "@/components/use-post";

type Variant = {
  id: string; sku: string; displayName: string | null; grade: string | null; finish: string | null;
  thicknessMm: string | null; widthMm: string | null; lengthMm: string | null; diameterMm: string | null;
  isActive: boolean; unit: { symbol: string } | null;
  attributes: Record<string, unknown>;
};

export function ProductVariantManager({ productId, variants, units }: { productId: string; variants: Variant[]; units: string[] }) {
  const router = useRouter();
  const { post, pending, error } = usePost();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [extraSpecs, setExtraSpecs] = useState("");
  const [search, setSearch] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
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
      {[["displayName", "Display name (optional)"], ["grade", "Grade"], ["finish", "Finish"], ["thickness", "Thickness (mm)"], ["width", "Width (mm)"], ["length", "Length (mm)"], ["diameter", "Diameter (mm)"]].map(([key, label]) => (
        <label key={key} className="text-xs font-medium text-muted">{label}<input className={`${inputClass} mt-1`} value={draft[key] ?? ""} type={key === "thickness" || key === "width" || key === "length" || key === "diameter" ? "number" : "text"} min="0.001" step="any" onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>
      ))}
      <label className="text-xs font-medium text-muted">Unit of measure<select className={`${inputClass} mt-1`} value={draft.uom ?? ""} onChange={(event) => setDraft({ ...draft, uom: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
      <label className="text-xs font-medium text-muted sm:col-span-2 lg:col-span-4">Additional product specifications<textarea className="mt-1 min-h-20 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={extraSpecs} onChange={(event) => setExtraSpecs(event.target.value)} placeholder="capacityLitres=2.5&#10;materialFamily=stainless steel" /><span className="mt-1 block font-normal">Enter optional product-specific fields as field=value, one per line.</span></label>
      <div className="flex items-end gap-2"><button type="button" disabled={pending} className="btn-primary h-10 px-4" onClick={() => void save(id)}>{id ? "Save variant" : "Add variant"}</button><button type="button" className="btn-secondary h-10 px-4" onClick={() => setEditing(null)}>Cancel</button></div>
      {localError || error ? <p className="sm:col-span-2 lg:col-span-4 text-sm text-danger">{localError || error}</p> : null}
    </div>
  );

  return <section className="mt-6">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">Product Variants / Specifications</h2><button type="button" className="btn-secondary h-9 px-3 text-sm" onClick={() => begin()}>Add variant</button></div>
    {variants.length ? <><input className="mb-2 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm sm:max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search variant specifications" aria-label="Search variants" /><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/10 text-xs uppercase text-muted"><tr>{["Display name / SKU", "Grade", "Finish", "Thickness", "Width", "Length", "UOM", "Status", "Actions"].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead><tbody>{visibleVariants.map((variant) => <tr key={variant.id} className="border-t border-border"><td className="px-3 py-2">{variant.displayName || variant.sku}<div className="text-xs text-muted">{variant.sku}</div></td><td className="px-3 py-2">{variant.grade || "—"}</td><td className="px-3 py-2">{variant.finish || "—"}</td><td className="px-3 py-2">{variant.thicknessMm ? `${variant.thicknessMm} mm` : "—"}</td><td className="px-3 py-2">{variant.widthMm ? `${variant.widthMm} mm` : "—"}</td><td className="px-3 py-2">{variant.lengthMm ? `${variant.lengthMm} mm` : "—"}</td><td className="px-3 py-2">{variant.unit?.symbol || "—"}</td><td className="px-3 py-2">{variant.isActive ? "Active" : "Inactive"}</td><td className="whitespace-nowrap px-3 py-2"><button type="button" className="mr-2 text-accent hover:underline" onClick={() => begin(variant)}>Edit</button><button type="button" disabled={pending} className="text-accent hover:underline" onClick={() => void deactivate(variant)}>{variant.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table>{!visibleVariants.length ? <p className="p-4 text-sm text-muted">No variants match this search.</p> : null}</div></> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">No variants yet. Add specifications to create another stock SKU.</p>}
    {editing === "new" ? editor() : null}
    {editing && editing !== "new" ? editor(editing) : null}
  </section>;
}

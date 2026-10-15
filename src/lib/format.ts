export function qtyNumber(value: { toString(): string } | string | number | null | undefined) {
  return Number(value?.toString() ?? 0);
}

/** Human-readable unit suffix (KG → kg, PCS → pcs). */
export function uomLabel(uom: string | null | undefined) {
  const key = (uom ?? "KG").trim().toUpperCase();
  if (key === "KG") return "kg";
  if (key === "PCS") return "pcs";
  if (key === "MTR" || key === "M") return "m";
  return key.toLowerCase();
}

export function formatQty(
  value: { toString(): string } | string | number | null | undefined,
  uom?: string | null,
) {
  const number = qtyNumber(value);
  return `${number.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ${uomLabel(uom)}`;
}

/** Mass / inventory quantities (always kilograms). */
export function kg(value: { toString(): string } | string | number | null | undefined) {
  return formatQty(value, "KG");
}

export function money(value: { toString(): string } | string | number) {
  return `₹${Number(value.toString()).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function when(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

/** Fixed locale/timezone so SSR and client nav greeting match (avoids hydration mismatch). */
export function formatDeskNavDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function toneFor(status: string) {
  if (["approved", "pass", "ready", "closed", "received", "idle", "available", "released", "open", "completed", "dispatched", "fulfilled", "ready_for_dispatch"].includes(status)) {
    return "success" as const;
  }
  if (["pending", "pending_approval", "submitted", "partial", "partially_dispatched", "in_progress", "hold", "assigned", "draft", "paused", "material_planning", "production", "on_hold"].includes(status)) {
    return "warning" as const;
  }
  if (["rejected", "fail", "cancelled", "down", "blocked", "rework"].includes(status)) return "danger" as const;
  return "info" as const;
}

export function labelFor(status: string) {
  return status.replaceAll("_", " ");
}

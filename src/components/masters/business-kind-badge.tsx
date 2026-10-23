import { StatusBadge } from "@/components/status-badge";
import { businessKindLabel, type BusinessKind } from "@/lib/domain/business-categories";

export function BusinessKindBadge({ kind }: { kind: BusinessKind | null | undefined }) {
  if (!kind) return <span className="text-sm text-muted">Unassigned</span>;
  return <StatusBadge label={businessKindLabel(kind)} tone={kind === "trading" ? "info" : "success"} />;
}

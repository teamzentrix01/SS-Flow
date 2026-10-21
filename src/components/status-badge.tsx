import { semanticColors, type SemanticTone } from "@/lib/semantic-colors";

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: SemanticTone;
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${semanticColors[tone].bg} ${semanticColors[tone].text}`}>
      {label}
    </span>
  );
}

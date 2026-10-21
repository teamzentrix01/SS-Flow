import { semanticColors } from "@/lib/semantic-colors";

export function FormFeedback({
  error,
  success,
}: {
  error: string | null;
  success?: string | null;
}) {
  return (
    <div className="space-y-2">
      {error ? (
        <p className={`rounded-[10px] ${semanticColors.danger.bg} px-3 py-2 text-sm ${semanticColors.danger.text}`} role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className={`rounded-[10px] border ${semanticColors.success.border} ${semanticColors.success.bg} px-3 py-2 text-sm font-medium ${semanticColors.success.text}`}
          role="status"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}

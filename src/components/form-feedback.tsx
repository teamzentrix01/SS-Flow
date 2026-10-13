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
        <p className="rounded-[10px] bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="rounded-[10px] border border-[var(--success-soft)] bg-[var(--success-soft)] px-3 py-2 text-sm font-medium text-[var(--success)]"
          role="status"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}

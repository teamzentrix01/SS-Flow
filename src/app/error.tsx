"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">This page could not load</h1>
        <p className="mt-2 text-sm text-muted">
          Your data has not been changed. Try loading the page again.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}

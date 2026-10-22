import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-semibold">Record not found</h1>
        <p className="mt-2 text-sm text-muted">
          It may have been removed, or you may not have access to it.
        </p>
        <Link href="/" className="cursor-pointer btn-primary mt-4">
          Back to home
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted">Your role does not include this action.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-steel">Back home</Link>
      </div>
    </main>
  );
}

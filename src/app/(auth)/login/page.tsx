import { LoginForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 text-foreground shadow-sm">
        <p className="inline-flex rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-graphite">SS-Steel-Flow</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 mb-5 text-sm text-muted">Sign in with your email or employee ID. Use Show to check the password.</p>
        <LoginForm />
      </div>
    </main>
  );
}

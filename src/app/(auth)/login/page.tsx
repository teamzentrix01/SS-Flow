import { LoginForm } from "@/components/forms";
import { BrandLogo } from "@/components/brand-logo";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between bg-[#3b4852] px-8 py-10 text-white lg:px-12 lg:py-12">
        <div>
          <BrandLogo variant="login" priority />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
            SteelFlow manufacturing ERP — production, inventory, sales, and dispatch for SS Metals.
          </p>
        </div>
        <div className="my-12 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Manage production, inventory, and orders with ease
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/85">
            Sign in to the desk dashboard to oversee sales orders, job cards, stock, purchasing, quality, and dispatch — all in one place.
          </p>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} SS Metals. All rights reserved.</p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <BrandLogo variant="sidebar" />
          </div>
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-[#1b1e1c]">Welcome back</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e2e6e3] bg-[#f6f7f6] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#3e4744]">
              <ShieldCheck className="size-3.5 text-[#1f6b4a]" />
              Secure
            </span>
          </div>
          <p className="mb-8 text-sm text-[#3e4744]">Sign in to your account to continue</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}

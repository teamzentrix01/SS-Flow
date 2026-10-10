import Link from "next/link";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { dashboardData, listShifts } from "@/lib/queries";
import { prisma } from "@/db";

export default async function DashboardPage() {
  const session = await requirePage("dashboard.view");
  const [data, shifts, plant] = await Promise.all([
    dashboardData(session.plantIds),
    listShifts(session.plantIds),
    session.plantIds[0] ? prisma.plant.findUnique({ where: { id: session.plantIds[0] }, select: { name: true } }) : null,
  ]);
  const running = Number(data.machines.running ?? 0);
  const down = Number(data.machines.down ?? 0);
  const idle = Number(data.machines.idle ?? 0);
  const machineTotal = running + down + idle;
  const dateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const shiftLabel = shifts.map((shift) => `${shift.name} ${shift.startTime}–${shift.endTime}`).join(" · ") || "No shift configured";
  const actions = [
    session.permissions.has("job.assign") ? { href: "/jobs", label: "Job board" } : null,
    session.permissions.has("production.manage") ? { href: "/production", label: "Production" } : null,
    session.permissions.has("purchase.manage") ? { href: "/purchasing/orders", label: "Purchase orders" } : null,
    session.permissions.has("inventory.view") ? { href: "/inventory", label: "Stock" } : null,
  ].filter((item) => item !== null);
  const quieter = [
    ["QC hold", kg(data.hold)],
    ["WIP", kg(data.wip)],
    ["Finished", kg(data.finished)],
    ["Reserved", kg(data.reserved)],
    ["Scrap today", kg(data.scrap)],
    ["Delayed jobs", String(data.delayedJobs)],
    ["Pending QC", String(data.pendingQc)],
    ["Machines down", String(down)],
  ];
  const workflow = [
    { label: "1. Buy", detail: "Create and approve a purchase order", href: "/purchasing/orders", permission: "purchase.manage" },
    { label: "2. Receive", detail: "Receive material into QC hold", href: "/purchasing/orders", permission: "purchase.manage" },
    { label: "3. Inspect", detail: "Release incoming material", href: "/quality", permission: "qc.decide" },
    { label: "4. Produce", detail: "Release orders and assign jobs", href: "/production", permission: "production.manage" },
    { label: "5. Dispatch", detail: "Ship final quality-passed stock", href: "/dispatch", permission: "dispatch.manage" },
  ].filter((step) => session.permissions.has(step.permission));

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{dateLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Factory Overview.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Everything happening on your production floor.</p>
          <p className="mt-3 text-sm">{plant?.name ?? "Plant"} · {shiftLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="btn-primary">{action.label}</Link>
          ))}
        </div>
      </section>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-lime p-5 text-graphite">
          <p className="text-sm font-medium">Production today</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{kg(data.output)}</p>
          <p className="mt-2 text-sm">Output posted today. Scrap {kg(data.scrap)}.</p>
        </article>
        <article className="rounded-2xl bg-periwinkle p-5 text-graphite">
          <p className="text-sm font-medium">Active jobs</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{data.activeJobs}</p>
          <p className="mt-2 text-sm">{data.pendingApprovals} waiting for supervisor approval.</p>
        </article>
        <article className="rounded-2xl bg-coral p-5 text-graphite">
          <p className="text-sm font-medium">Raw material stock</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{kg(data.available)}</p>
          <p className="mt-2 text-sm">Available kilograms. {kg(data.reserved)} reserved.</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium text-muted">Machines online</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight">{running}<span className="text-lg text-muted"> / {machineTotal}</span></p>
          <p className="mt-2 text-sm text-muted">{down} down · {idle} idle</p>
        </article>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quieter.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </section>
      {workflow.length ? (
        <section className="space-y-3">
          <div><h2 className="font-semibold">Your workflow</h2><p className="text-sm text-muted">Open the next desk task from here.</p></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {workflow.map((step) => (
              <Link key={step.label} href={step.href} className="rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-foreground">
                <p className="font-semibold">{step.label}</p>
                <p className="mt-1 text-sm text-muted">{step.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

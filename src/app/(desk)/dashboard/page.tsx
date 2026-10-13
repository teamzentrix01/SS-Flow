import Link from "next/link";
import { KpiCard } from "@/components/kpi-card";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { dashboardData, listShifts } from "@/lib/queries";
import { prisma } from "@/db";

function kgParts(formatted: string) {
  const trimmed = formatted.replace(/\s*kg\s*$/i, "").trim();
  return { value: trimmed, unit: "kg" };
}

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
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const shiftLabel = shifts.map((shift) => `${shift.name} ${shift.startTime}–${shift.endTime}`).join(" · ") || "No shift configured";
  const actions = [
    session.permissions.has("job.assign") ? { href: "/jobs", label: "Job board", primary: true } : null,
    session.permissions.has("production.manage") ? { href: "/production", label: "Production", primary: false } : null,
    session.permissions.has("purchase.manage") ? { href: "/purchasing/orders", label: "Purchase orders", primary: false } : null,
    session.permissions.has("inventory.view") ? { href: "/inventory", label: "Stock", primary: false } : null,
  ].filter((item) => item !== null);

  const output = kgParts(kg(data.output));
  const scrap = kg(data.scrap);
  const available = kgParts(kg(data.available));
  const reserved = kg(data.reserved);

  const secondary = [
    { label: "QC hold", ...kgParts(kg(data.hold)) },
    { label: "WIP", ...kgParts(kg(data.wip)) },
    { label: "Finished", ...kgParts(kg(data.finished)) },
    { label: "Reserved", ...kgParts(kg(data.reserved)) },
    { label: "Scrap today", ...kgParts(kg(data.scrap)) },
    { label: "Delayed jobs", value: String(data.delayedJobs), unit: undefined },
    { label: "Pending QC", value: String(data.pendingQc), unit: undefined },
    { label: "Machines down", value: String(down), unit: undefined },
  ];

  const workflow = [
    { label: "1. Buy", detail: "Create and approve a purchase order", href: "/purchasing/orders", permission: "purchase.manage" },
    { label: "2. Receive", detail: "Receive material into QC hold", href: "/purchasing/orders", permission: "purchase.manage" },
    { label: "3. Inspect", detail: "Release incoming material", href: "/quality", permission: "qc.decide" },
    { label: "4. Produce", detail: "Release orders and assign jobs", href: "/production", permission: "production.manage" },
    { label: "5. Dispatch", detail: "Ship final quality-passed stock", href: "/dispatch", permission: "dispatch.manage" },
  ].filter((step) => session.permissions.has(step.permission));

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 lg:px-8">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">{dateLabel}</p>
          <h1 className="mt-2 text-[36px] font-semibold tracking-[-0.02em] text-[var(--ink)]">Factory overview</h1>
          <p className="mt-2 max-w-xl text-[15px] text-[var(--ink-muted)]">
            Everything happening on your production floor.
          </p>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {plant?.name ?? "Plant"} · {shiftLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={action.primary ? "btn-dashboard-primary" : "btn-dashboard-secondary"}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <KpiCard
          variant="primary"
          label="Production today"
          value={output.value}
          unit={output.unit}
          detail={`Output posted today. Scrap ${scrap}.`}
        />
        <KpiCard
          variant="primary"
          label="Active jobs"
          value={String(data.activeJobs)}
          detail={`${data.pendingApprovals} waiting for supervisor approval.`}
        />
        <KpiCard
          variant="primary"
          label="Raw material stock"
          value={available.value}
          unit={available.unit}
          detail={`Available kilograms. ${reserved} reserved.`}
        />
        <KpiCard
          variant="primary"
          label="Machines online"
          value={`${running} / ${machineTotal}`}
          detail={`${down} down · ${idle} idle`}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-[var(--ink)]">Material &amp; quality</h2>
        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {secondary.map((row) => (
            <KpiCard
              key={row.label}
              variant="compact"
              label={row.label}
              value={row.value}
              unit={row.unit}
            />
          ))}
        </div>
      </section>

      {workflow.length ? (
        <section className="mt-10 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">Your workflow</h2>
            <p className="text-sm text-[var(--ink-muted)]">Open the next desk task from here.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {workflow.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--ink-muted)] hover:bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                <p className="font-semibold text-[var(--ink)]">{step.label}</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{step.detail}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

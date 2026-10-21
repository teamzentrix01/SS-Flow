import Link from "next/link";
import {
  Clock,
  Cog,
  ClipboardList,
  Layers,
  LineChart,
  Lock,
  Package,
  PackageCheck,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { requirePage } from "@/lib/access";
import { kg } from "@/lib/format";
import { dashboardData, listShifts } from "@/lib/queries";
import { prisma } from "@/db";

function kgParts(formatted: string) {
  const trimmed = formatted.replace(/\s*kg\s*$/i, "").trim();
  return { value: trimmed, unit: "kg" };
}

const kpiGrid = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]";

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
    session.permissions.has("job.approve") && data.pendingApprovals > 0
      ? { href: "/job-approvals", label: `Step approvals (${data.pendingApprovals})`, primary: true }
      : null,
    session.permissions.has("job.assign") ? { href: "/jobs", label: "Job board", primary: !session.permissions.has("job.approve") || data.pendingApprovals === 0 } : null,
    session.permissions.has("job.approve") && data.pendingApprovals === 0
      ? { href: "/job-approvals", label: "Step approvals", primary: false }
      : null,
    session.permissions.has("production.manage") ? { href: "/production", label: "Production", primary: false } : null,
    session.permissions.has("purchase.manage") ? { href: "/purchase-orders", label: "Purchase orders", primary: false } : null,
    session.permissions.has("inventory.view") ? { href: "/inventory", label: "Stock", primary: false } : null,
  ].filter((item) => item !== null);

  const output = kgParts(kg(data.output));
  const available = kgParts(kg(data.available));

  const overview = [
    {
      label: "Production today",
      ...output,
      icon: LineChart,
      iconClassName: "bg-success-soft text-success",
    },
    {
      label: "Active jobs",
      value: String(data.activeJobs),
      unit: undefined,
      icon: ClipboardList,
      iconClassName: "bg-info-soft text-info",
    },
    ...(session.permissions.has("job.approve")
      ? [
          {
            label: "Steps awaiting approval",
            value: String(data.pendingApprovals),
            unit: undefined,
            icon: ClipboardList,
            iconClassName: "bg-warning-soft text-warning",
          },
        ]
      : []),
    {
      label: "Raw material stock",
      ...available,
      icon: Package,
      iconClassName: "bg-neutral-soft text-neutral",
    },
    {
      label: "Machines online",
      value: `${running} / ${machineTotal}`,
      unit: undefined,
      icon: Cog,
      iconClassName: "bg-success-soft text-success",
    },
  ] as const;

  const materialQuality = [
    { label: "QC hold", ...kgParts(kg(data.hold)), icon: ShieldCheck, iconClassName: "bg-warning-soft text-warning" },
    { label: "WIP", ...kgParts(kg(data.wip)), icon: Layers, iconClassName: "bg-info-soft text-info" },
    { label: "Finished", ...kgParts(kg(data.finished)), icon: PackageCheck, iconClassName: "bg-success-soft text-success" },
    { label: "Reserved", ...kgParts(kg(data.reserved)), icon: Lock, iconClassName: "bg-neutral-soft text-neutral" },
    { label: "Scrap today", ...kgParts(kg(data.scrap)), icon: Trash2, iconClassName: "bg-danger-soft text-danger" },
    { label: "Delayed jobs", value: String(data.delayedJobs), unit: undefined, icon: Clock, iconClassName: "bg-danger-soft text-danger" },
    { label: "Pending QC", value: String(data.pendingQc), unit: undefined, icon: ShieldAlert, iconClassName: "bg-warning-soft text-warning" },
    { label: "Machines down", value: String(down), unit: undefined, icon: Wrench, iconClassName: "bg-danger-soft text-danger" },
  ] as const;

  const workflow = [
    { label: "1. Buy", detail: "Create and approve a purchase order", href: "/purchase-orders", permission: "purchase.manage" },
    { label: "2. Receive", detail: "Receive material into QC hold", href: "/purchase-orders", permission: "purchase.manage" },
    { label: "3. Inspect", detail: "Release incoming material", href: "/quality", permission: "qc.decide" },
    { label: "4. Produce", detail: "Release orders and assign jobs", href: "/production", permission: "production.manage" },
    { label: "5. Dispatch", detail: "Ship final quality-passed stock", href: "/dispatch", permission: "dispatch.manage" },
  ].filter((step) => session.permissions.has(step.permission));

  return (
    <div className="mx-auto max-w-[1280px]">
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

      <section className="mt-8">
        <h2 className="text-base font-semibold text-[var(--ink)]">Today at a glance</h2>
        <div className={`mt-4 ${kpiGrid}`}>
          {overview.map((row) => (
            <KpiCard
              key={row.label}
              label={row.label}
              value={row.value}
              unit={"unit" in row ? row.unit : undefined}
              icon={row.icon}
              iconClassName={row.iconClassName}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold text-[var(--ink)]">Material &amp; quality</h2>
        <div className={`mt-4 ${kpiGrid}`}>
          {materialQuality.map((row) => (
            <KpiCard
              key={row.label}
              label={row.label}
              value={row.value}
              unit={"unit" in row ? row.unit : undefined}
              icon={row.icon}
              iconClassName={row.iconClassName}
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

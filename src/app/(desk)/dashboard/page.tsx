import Link from "next/link";
import {
  ArrowRight,
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

const kpiGrid = "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]";

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
      // Solid green icon, very-light green card tint
      iconClassName: "bg-[#22c55e] text-white",
      cardClassName: "border-[#bbf7d0] bg-[#f0fdf4]",
    },
    {
      label: "Active jobs",
      value: String(data.activeJobs),
      unit: undefined,
      icon: ClipboardList,
      // Solid blue icon, very-light blue card tint
      iconClassName: "bg-[#3b82f6] text-white",
      cardClassName: "border-[#bfdbfe] bg-[#eff6ff]",
    },
    ...(session.permissions.has("job.approve")
      ? [
          {
            label: "Steps awaiting approval",
            value: String(data.pendingApprovals),
            unit: undefined,
            icon: ClipboardList,
            // Solid orange icon, very-light amber card tint
            iconClassName: "bg-[#f97316] text-white",
            cardClassName: "border-[#fed7aa] bg-[#fff7ed]",
          },
        ]
      : []),
    {
      label: "Raw material stock",
      ...available,
      icon: Package,
      // Solid violet icon, very-light purple card tint
      iconClassName: "bg-[#8b5cf6] text-white",
      cardClassName: "border-[#ddd6fe] bg-[#f5f3ff]",
    },
    {
      label: "Machines online",
      value: `${running} / ${machineTotal}`,
      unit: undefined,
      icon: Cog,
      // Solid cyan icon, very-light cyan card tint
      iconClassName: "bg-[#06b6d4] text-white",
      cardClassName: "border-[#a5f3fc] bg-[#ecfeff]",
    },
  ] as const;

  const materialQuality = [
    {
      label: "QC hold",
      ...kgParts(kg(data.hold)),
      icon: ShieldCheck,
      iconClassName: "bg-[#f97316] text-white",
      cardClassName: "border-[#fed7aa] bg-[#fff7ed]",
    },
    {
      label: "WIP",
      ...kgParts(kg(data.wip)),
      icon: Layers,
      iconClassName: "bg-[#6366f1] text-white",
      cardClassName: "border-[#c7d2fe] bg-[#eef2ff]",
    },
    {
      label: "Finished",
      ...kgParts(kg(data.finished)),
      icon: PackageCheck,
      iconClassName: "bg-[#22c55e] text-white",
      cardClassName: "border-[#bbf7d0] bg-[#f0fdf4]",
    },
    {
      label: "Reserved",
      ...kgParts(kg(data.reserved)),
      icon: Lock,
      iconClassName: "bg-[#64748b] text-white",
      cardClassName: "border-[#cbd5e1] bg-[#f8fafc]",
    },
    {
      label: "Scrap today",
      ...kgParts(kg(data.scrap)),
      icon: Trash2,
      iconClassName: "bg-[#ef4444] text-white",
      cardClassName: "border-[#fecaca] bg-[#fef2f2]",
    },
    {
      label: "Delayed jobs",
      value: String(data.delayedJobs),
      unit: undefined,
      icon: Clock,
      iconClassName: "bg-[#dc2626] text-white",
      cardClassName: "border-[#fecaca] bg-[#fef2f2]",
    },
    {
      label: "Pending QC",
      value: String(data.pendingQc),
      unit: undefined,
      icon: ShieldAlert,
      iconClassName: "bg-[#f59e0b] text-white",
      cardClassName: "border-[#fde68a] bg-[#fffbeb]",
    },
    {
      label: "Machines down",
      value: String(down),
      unit: undefined,
      icon: Wrench,
      iconClassName: "bg-[#e11d48] text-white",
      cardClassName: "border-[#fecdd3] bg-[#fff1f2]",
    },
  ] as const;

  const workflowSteps = [
    { num: 1, label: "Buy", detail: "Create and approve a purchase order", href: "/purchase-orders", permission: "purchase.manage", color: "#3b82f6" },
    { num: 2, label: "Receive", detail: "Receive material into QC hold", href: "/purchase-orders", permission: "purchase.manage", color: "#f59e0b" },
    { num: 3, label: "Inspect", detail: "Release incoming material", href: "/quality", permission: "qc.decide", color: "#8b5cf6" },
    { num: 4, label: "Produce", detail: "Release orders and assign jobs", href: "/production", permission: "production.manage", color: "#06b6d4" },
    { num: 5, label: "Dispatch", detail: "Ship final quality-passed stock", href: "/dispatch", permission: "dispatch.manage", color: "#16a34a" },
  ].filter((step) => session.permissions.has(step.permission));

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* ── Header ── */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#16a34a]">{dateLabel}</p>
          <h1 className="mt-1.5 text-[34px] font-bold tracking-[-0.02em] text-[var(--ink)]">Factory overview</h1>
          <p className="mt-1 text-[14px] text-[var(--ink-muted)]">
            Everything happening on your production floor.
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)]">
            <Clock className="size-3.5 shrink-0" strokeWidth={1.75} />
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

      {/* ── Today at a glance ── */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">Today at a glance</h2>
        <div className={`mt-3 ${kpiGrid}`}>
          {overview.map((row) => (
            <KpiCard
              key={row.label}
              label={row.label}
              value={row.value}
              unit={"unit" in row ? row.unit : undefined}
              icon={row.icon}
              iconClassName={row.iconClassName}
              cardClassName={row.cardClassName}
            />
          ))}
        </div>
      </section>

      {/* ── Material & quality ── */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-[var(--ink)]">Material &amp; quality</h2>
        <div className={`mt-3 ${kpiGrid}`}>
          {materialQuality.map((row) => (
            <KpiCard
              key={row.label}
              label={row.label}
              value={row.value}
              unit={"unit" in row ? row.unit : undefined}
              icon={row.icon}
              iconClassName={row.iconClassName}
              cardClassName={row.cardClassName}
            />
          ))}
        </div>
      </section>

      {/* ── Your workflow ── */}
      {workflowSteps.length ? (
        <section className="mt-8 space-y-3">
          <div>
            <h2 className="text-[13px] font-semibold text-[var(--ink)]">Your workflow</h2>
            <p className="text-[13px] text-[var(--ink-muted)]">Open the next desk task from here.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {workflowSteps.map((step) => (
              <Link
                key={step.label}
                href={step.href}
                className="group flex flex-col gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--ink-muted)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
              >
                {/* Numbered circle */}
                <span
                  className="inline-flex size-7 items-center justify-center rounded-full border-2 text-[12px] font-bold"
                  style={{ borderColor: step.color, color: step.color }}
                >
                  {step.num}
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-[var(--ink)]">{step.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--ink-muted)]">{step.detail}</p>
                </div>
                <ArrowRight
                  className="size-4 self-end transition-transform group-hover:translate-x-0.5"
                  style={{ color: step.color }}
                  strokeWidth={2}
                />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

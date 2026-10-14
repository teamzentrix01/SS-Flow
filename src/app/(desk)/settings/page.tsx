import Link from "next/link";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { plantSetup } from "@/lib/queries";

export default async function SettingsPage() {
  const session = await requirePage("plant.manage");
  const setup = await plantSetup(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Plant setup" detail="Seeded master data for the first plant." />
      {session.permissions.has("user.manage") ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Access</p>
          <Link
            href="/users"
            className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
          >
            Manage users and roles
          </Link>
        </section>
      ) : null}
      {session.permissions.has("plant.manage") ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Masters (from Settings)</p>
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link href="/products" className="font-semibold text-accent underline-offset-2 hover:underline">
                Product catalog
              </Link>
              <span className="text-muted"> — categories, units, families, and SKUs</span>
            </li>
          </ul>
        </section>
      ) : null}
      {session.permissions.has("machine.manage") ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Plant assets</p>
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/machines" className="text-accent underline-offset-2 hover:underline">
              Machines
            </Link>
            <Link href="/dies" className="text-accent underline-offset-2 hover:underline">
              Dies
            </Link>
          </div>
        </section>
      ) : null}
      <SimpleTable columns={["Plant", "Code"]} rows={setup.plants.map((row) => [row.name, row.code])} />
      <SimpleTable columns={["Department"]} rows={setup.departments.map((row) => [row.name])} />
      <SimpleTable columns={["Warehouse", "Locations"]} rows={setup.warehouses.map((row) => [row.name, row.locations.map((location) => location.code).join(", ")])} />
      <SimpleTable columns={["Shift", "Hours"]} rows={setup.shifts.map((row) => [row.name, `${row.startTime}–${row.endTime}`])} />
    </div>
  );
}

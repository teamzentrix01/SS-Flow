import { ThemeToggle } from "@/components/theme-toggle";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { plantSetup } from "@/lib/queries";

export default async function SettingsPage() {
  const session = await requirePage("plant.manage");
  const setup = await plantSetup(session.plantIds);
  return (
    <div className="space-y-6">
      <PageHeader title="Plant setup" detail="Seeded master data for the first plant." />
      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Appearance</p>
        <ThemeToggle />
      </section>
      <SimpleTable columns={["Plant", "Code"]} rows={setup.plants.map((row) => [row.name, row.code])} />
      <SimpleTable columns={["Department"]} rows={setup.departments.map((row) => [row.name])} />
      <SimpleTable columns={["Warehouse", "Locations"]} rows={setup.warehouses.map((row) => [row.name, row.locations.map((location) => location.code).join(", ")])} />
      <SimpleTable columns={["Shift", "Hours"]} rows={setup.shifts.map((row) => [row.name, `${row.startTime}–${row.endTime}`])} />
    </div>
  );
}

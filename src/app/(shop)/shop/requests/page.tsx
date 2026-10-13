import { MaterialRequestForm } from "@/components/forms";
import { requirePage } from "@/lib/access";
import { listMaterials } from "@/lib/queries";

export default async function ShopRequestsPage() {
  const session = await requirePage("material.request");
  const materials = await listMaterials(session.plantIds);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Material shortage</h1>
      <p className="text-sm text-muted">Raise a request when stock on the floor is insufficient.</p>
      <section className="rounded-2xl border border-border bg-card p-4">
        <MaterialRequestForm materials={materials.map((m) => ({ id: m.id, name: m.name }))} />
      </section>
    </div>
  );
}

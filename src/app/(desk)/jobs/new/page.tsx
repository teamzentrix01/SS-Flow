import { JobCreateForm } from "@/components/forms";
import { DeskFormPage } from "@/components/desk";
import { requirePage } from "@/lib/access";
import { availableBatches, listMaterials } from "@/lib/queries";

export default async function NewJobPage() {
  const session = await requirePage("job.assign");
  const [materials, batches] = await Promise.all([
    listMaterials(session.plantIds),
    availableBatches(session.plantIds),
  ]);
  return (
    <DeskFormPage title="Create job" backHref="/jobs" backLabel="Back to job board">
      <JobCreateForm
        products={materials.map((item) => ({ id: item.id, name: item.name }))}
        batches={batches}
      />
    </DeskFormPage>
  );
}

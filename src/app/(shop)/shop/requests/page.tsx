import Link from "next/link";
import { MaterialRequestForm } from "@/components/forms";
import { JobMaterialAllocationForm, MaterialSubstitutionRequestForm } from "@/components/job-material-allocation";
import { ShopPrepareMaterial } from "@/components/shop-prepare-material";
import { requirePage } from "@/lib/access";
import { labelFor } from "@/lib/format";
import { jobStartMaterialData, listMaterials, myOpenShopJobs } from "@/lib/queries";

export default async function ShopRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const session = await requirePage("material.request");
  const { job: selectedJobId } = await searchParams;
  const materials = await listMaterials(session.plantIds);
  const jobs = session.employeeId ? await myOpenShopJobs(session.employeeId) : [];
  const selected = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const materialData = selected ? await jobStartMaterialData(selected.id, session.plantIds) : null;
  const hasAllocation = selected?.materialIssues.some((issue) => Number(issue.quantityPlanned) > 0) ?? false;
  const canPrepare = Boolean(selected?.machineId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Material</h1>
      <p className="text-sm text-muted">
        Allocate source batches, request a substitute, or raise a shortage. Start the job from the job card.
      </p>

      {jobs.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {jobs.map((job) => {
            const active = job.id === selected?.id;
            return (
              <Link
                key={job.id}
                href={`/shop/requests?job=${job.id}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active ? "border-accent bg-accent-soft font-medium" : "border-border bg-card text-muted hover:text-foreground"
                }`}
              >
                {job.number}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {selected && materialData ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Job</p>
            <p className="font-semibold">
              {selected.number} · {selected.name}
            </p>
            <p className="text-sm text-muted">
              {labelFor(selected.status)} · {selected.batch?.batchNo ?? "No batch linked"}
            </p>
            <Link href={`/shop/jobs/${selected.id}`} className="mt-2 inline-block text-sm text-accent hover:underline">
              Open job →
            </Link>
          </div>
          {canPrepare && !hasAllocation && materialData.candidates.length ? (
            <JobMaterialAllocationForm jobId={selected.id} candidates={materialData.candidates} redirectTo={`/shop/requests?job=${selected.id}`} />
          ) : null}
          {canPrepare && !hasAllocation && materialData.substitutionOptions.batches.length ? (
            <MaterialSubstitutionRequestForm
              jobId={selected.id}
              requirements={materialData.substitutionOptions.requirements}
              batches={materialData.substitutionOptions.batches}
              redirectTo={`/shop/requests?job=${selected.id}`}
            />
          ) : null}
          {canPrepare && !selected.batchId ? (
            <ShopPrepareMaterial jobId={selected.id} redirectTo={`/shop/requests?job=${selected.id}`} />
          ) : null}
          {hasAllocation ? (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
              Material is already allocated for this job.
            </p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted">
          No assigned open jobs. You can still raise a shortage below.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Shortage request</h2>
          <p className="text-sm text-muted">Raise a request when stock on the floor is insufficient.</p>
        </div>
        <MaterialRequestForm materials={materials.map((material) => ({ id: material.id, name: material.name }))} />
      </section>
    </div>
  );
}

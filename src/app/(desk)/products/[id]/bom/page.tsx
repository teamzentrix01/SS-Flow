import { notFound } from "next/navigation";
import { BomForm } from "@/components/forms";
import { PageHeader, SimpleTable } from "@/components/ui";
import { requirePage } from "@/lib/access";
import { formatQty } from "@/lib/format";
import { activeBom, listMaterials } from "@/lib/queries";
import { prisma } from "@/db";

export default async function BomPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("production.manage");
  const { id } = await params;
  const product = await prisma.materialMaster.findFirst({ where: { id, plantId: { in: session.plantIds } } });
  if (!product) notFound();
  const [bom, materials] = await Promise.all([activeBom(id, session.plantIds), listMaterials(session.plantIds)]);
  const rawMaterials = materials.filter((m) => m.category === "raw" || m.category === "consumable");
  return (
    <div className="space-y-6">
      <PageHeader title={`BOM · ${product.name}`} detail={`Version ${bom?.version ?? 0}`} />
      {bom?.items.length ? (
        <SimpleTable
          columns={["Material", "Qty per", "UOM", "Type"]}
          rows={bom.items.map((item) => [
            item.material.name,
            formatQty(item.qtyPer, item.uom),
            item.uom,
            item.lineType,
          ])}
        />
      ) : null}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">{bom ? "New BOM version" : "Create BOM"}</h2>
        <BomForm
          productId={id}
          materials={rawMaterials.map((m) => ({ id: m.id, name: m.name }))}
          defaults={
            bom
              ? {
                  scrapRate: bom.scrapRate.toString(),
                  materialId: bom.items[0]?.materialId ?? rawMaterials[0]?.id ?? "",
                  qtyPer: bom.items[0]?.qtyPer.toString() ?? "0.05",
                }
              : undefined
          }
        />
      </section>
    </div>
  );
}

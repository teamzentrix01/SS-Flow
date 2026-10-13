import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

export async function upsertBom(
  session: SessionUser,
  productId: string,
  input: {
    scrapRate?: string;
    items: {
      materialId: string;
      lineType?: string;
      qtyPer: string;
      lossPct?: string;
      uom?: string;
      dimLength?: string;
      dimWidth?: string;
      dimThickness?: string;
    }[];
  },
  key: string | null,
) {
  allow(session, "production.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "bom.upsert",
    key,
    run: async (tx) => {
      const product = await tx.materialMaster.findFirst({ where: { id: productId, plantId } });
      if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
      const latest = await tx.bomHeader.findFirst({
        where: { plantId, productId },
        orderBy: { version: "desc" },
      });
      const version = (latest?.version ?? 0) + 1;
      if (latest?.active) {
        await tx.bomHeader.update({ where: { id: latest.id }, data: { active: false } });
      }
      const bom = await tx.bomHeader.create({
        data: {
          id: uuidv7(),
          plantId,
          productId,
          version,
          scrapRate: input.scrapRate ?? latest?.scrapRate.toString() ?? "0.05",
          active: true,
          items: {
            create: input.items.map((line) => ({
              id: uuidv7(),
              materialId: line.materialId,
              lineType: line.lineType ?? "metal_sheet",
              qtyPer: line.qtyPer,
              lossPct: line.lossPct ?? "0",
              uom: line.uom ?? "KG",
              dimLength: line.dimLength || null,
              dimWidth: line.dimWidth || null,
              dimThickness: line.dimThickness || null,
            })),
          },
        },
        include: { items: true },
      });
      await audit(tx, { userId: session.userId, action: "bom.upsert", resource: "bom", resourceId: bom.id, payload: { version } });
      return { id: bom.id, version: bom.version, items: bom.items.length };
    },
  });
}

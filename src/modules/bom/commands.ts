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
      const product = await tx.materialMaster.findFirst({
        where: { id: productId, plantId },
        include: { productCategory: true },
      });
      if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");
      if (!product.manufacturingAllowed) {
        throw new AppError(400, "NOT_MANUFACTURABLE", `Product "${product.name}" is not flagged as eligible for manufacturing.`);
      }
      if (product.productCategory) {
        if (product.productCategory.status !== "active") {
          throw new AppError(409, "CATEGORY_INACTIVE", `Category "${product.productCategory.name}" is not active.`);
        }
        if (product.productCategory.categoryType === "consumable" || product.productCategory.categoryType === "scrap") {
          throw new AppError(400, "NOT_MANUFACTURABLE", `Category "${product.productCategory.name}" (${product.productCategory.categoryType}) is not eligible for production BOMs.`);
        }
      }
      for (const line of input.items) {
        const comp = await tx.materialMaster.findFirst({
          where: { id: line.materialId, plantId },
          include: { productCategory: true },
        });
        if (!comp) {
          throw new AppError(404, "NOT_FOUND", `BOM component material "${line.materialId}" was not found.`);
        }
        if (!comp.active) {
          throw new AppError(400, "VALIDATION", `BOM component material "${comp.name}" is inactive.`);
        }
        if (comp.productCategory && comp.productCategory.status !== "active") {
          throw new AppError(409, "CATEGORY_INACTIVE", `Component category "${comp.productCategory.name}" is not active.`);
        }
        if (comp.productCategory && comp.productCategory.categoryType === "scrap") {
          throw new AppError(400, "VALIDATION", `Scrap material "${comp.name}" cannot be used as a BOM raw material component.`);
        }
      }
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

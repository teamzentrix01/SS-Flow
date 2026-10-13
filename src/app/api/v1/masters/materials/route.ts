import type { z } from "zod";
import { createMaterial } from "@/modules/masters/commands";
import { action } from "@/lib/action";
import { materialSchema } from "@/lib/schemas";

function normalizeProductBody(body: z.infer<typeof materialSchema>) {
  const optional = (value?: string) => value?.trim() || undefined;
  return {
    ...body,
    categoryId: optional(body.categoryId),
    defaultBomHeaderId: optional(body.defaultBomHeaderId),
    defaultRoutingId: optional(body.defaultRoutingId),
    defaultSupplierId: optional(body.defaultSupplierId),
    thickness: optional(body.thickness),
    width: optional(body.width),
    length: optional(body.length),
    diameter: optional(body.diameter),
    weightPerPiece: optional(body.weightPerPiece),
    standardScrapPct: optional(body.standardScrapPct),
    uomConversionFactor: optional(body.uomConversionFactor),
    minStockLevel: optional(body.minStockLevel),
    reorderLevel: optional(body.reorderLevel),
    purchasePrice: optional(body.purchasePrice),
    sellingPrice: optional(body.sellingPrice),
    taxRate: optional(body.taxRate),
  };
}

export const POST = action("plant.manage", materialSchema, (session, body, key) =>
  createMaterial(session, normalizeProductBody(body), key),
);

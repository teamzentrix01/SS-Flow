import type { z } from "zod";
import { createDeskProduct } from "@/modules/masters/product-catalog";
import { action } from "@/lib/action";
import { createProductSchema } from "@/lib/schemas";

function normalizeBody(body: z.infer<typeof createProductSchema>) {
  const optional = (value?: string) => value?.trim() || undefined;
  return {
    sku: optional(body.sku),
    name: body.name,
    businessKind: body.businessKind,
    baseUnitSymbol: body.baseUnitSymbol?.trim() ?? "",
    description: optional(body.description),
    specs: Object.fromEntries(
      Object.entries(body.specs ?? {})
        .map(([key, value]) => [key, optional(value)])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ),
  };
}

export const POST = action("plant.manage", createProductSchema, (session, body, key) =>
  createDeskProduct(session, normalizeBody(body), key),
);

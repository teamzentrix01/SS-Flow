import type { z } from "zod";
import { action } from "@/lib/action";
import { createProductSchema } from "@/lib/schemas";
import { updateDeskProduct } from "@/modules/masters/product-catalog";

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const handler = action("plant.manage", createProductSchema, (session, body, key) =>
    updateDeskProduct(session, id, normalizeBody(body), key),
  );
  return handler(request);
}

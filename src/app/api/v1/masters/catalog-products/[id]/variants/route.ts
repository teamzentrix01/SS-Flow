import { action } from "@/lib/action";
import { productVariantSchema } from "@/lib/schemas";
import { saveProductVariant } from "@/modules/masters/product-catalog";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return action("plant.manage", productVariantSchema, (session, body, key) =>
    saveProductVariant(session, id, body, key),
  )(request);
}

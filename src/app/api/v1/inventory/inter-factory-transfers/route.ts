import { createInterFactoryTransfer } from "@/lib/commands";
import { action } from "@/lib/action";
import { jsonData, jsonError } from "@/lib/api";
import { plantIdsForSession, requirePermission } from "@/lib/access";
import { parseInventoryFilters } from "@/modules/inventory/filters";
import { listInterFactoryTransfers } from "@/modules/inventory/queries";
import { interFactoryCreateSchema } from "@/lib/schemas";

export const POST = action("inventory.move", interFactoryCreateSchema, (session, body, key) =>
  createInterFactoryTransfer(session, body, key),
);

export async function GET(request: Request) {
  try {
    const session = await requirePermission("inventory.view");
    const plantIds = await plantIdsForSession(session);
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const filters = parseInventoryFilters(params, plantIds);
    return jsonData(await listInterFactoryTransfers(filters));
  } catch (error) {
    return jsonError(error);
  }
}

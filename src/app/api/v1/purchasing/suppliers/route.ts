import { createSupplier } from "@/lib/commands";
import { action } from "@/lib/action";
import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { listAllSuppliers } from "@/lib/queries";
import { supplierSchema } from "@/lib/schemas";

export async function GET() {
  try {
    await requirePermission("purchase.manage");
    const rows = await listAllSuppliers();
    return jsonData(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        plantId: row.plantId,
        plantName: row.plant.name,
        contact: row.contact ?? undefined,
      })),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("purchase.manage", supplierSchema, (session, body, key) => createSupplier(session, body, key));

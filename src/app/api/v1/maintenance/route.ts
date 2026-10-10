import { openMaintenance } from "@/lib/commands";
import { action } from "@/lib/action";
import { maintenanceSchema } from "@/lib/schemas";

export const POST = action("machine.manage", maintenanceSchema, (session, body, key) => openMaintenance(session, body, key));

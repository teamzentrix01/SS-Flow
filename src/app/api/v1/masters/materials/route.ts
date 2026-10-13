import { createMaterial } from "@/modules/masters/commands";
import { action } from "@/lib/action";
import { materialSchema } from "@/lib/schemas";

export const POST = action("plant.manage", materialSchema, (session, body, key) => createMaterial(session, body, key));

import { createMaterialRequest } from "@/modules/material-requests/commands";
import { action } from "@/lib/action";
import { materialRequestSchema } from "@/lib/schemas";

export const POST = action("material.request", materialRequestSchema, (session, body, key) =>
  createMaterialRequest(session, body, key),
);

import { action } from "@/lib/action";
import { specOptionUpdateSchema } from "@/lib/schemas";
import { updateSpecOption } from "@/modules/masters/spec-options";

  export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;
    return action("plant.manage", specOptionUpdateSchema, (session, body) =>
      updateSpecOption(session, id, body),
    )(request);
  }

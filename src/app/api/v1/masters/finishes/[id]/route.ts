import { action } from "@/lib/action";
import { finishMasterUpdateSchema } from "@/lib/schemas";
import { updateFinish } from "@/modules/masters/grades-finishes";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return action("plant.manage", finishMasterUpdateSchema, (session, body) =>
    updateFinish(session, id, body),
  )(request);
}

import { action } from "@/lib/action";
import { gradeMasterUpdateSchema } from "@/lib/schemas";
import { updateGrade } from "@/modules/masters/grades-finishes";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return action("plant.manage", gradeMasterUpdateSchema, (session, body) =>
    updateGrade(session, id, body),
  )(request);
}

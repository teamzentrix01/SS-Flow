import { createJob } from "@/lib/commands";
import { action } from "@/lib/action";
import { createJobSchema } from "@/lib/schemas";

export const POST = action("job.assign", createJobSchema, (session, body, key) =>
  createJob(session, { ...body, sourceBatchId: body.sourceBatchId || undefined }, key),
);

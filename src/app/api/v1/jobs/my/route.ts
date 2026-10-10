import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { myJobs } from "@/lib/queries";

export async function GET() {
  try {
    const session = await requirePermission("job.execute");
    if (!session.employeeId) throw new AppError(403, "FORBIDDEN", "This login is not linked to an employee.");
    const jobs = await myJobs(session.employeeId);
    return jsonData(jobs.map((job) => ({ id: job.id, number: job.number, status: job.status, name: job.name })));
  } catch (error) {
    return jsonError(error);
  }
}

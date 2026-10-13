import type { Prisma } from "@prisma/client";
import { uuidv7 } from "@/lib/ids";

type Tx = Prisma.TransactionClient;

export async function recordJobStatus(
  tx: Tx,
  jobId: string,
  userId: string,
  fromStatus: string | null,
  toStatus: string,
  remarks?: string,
) {
  await tx.jobStatusEvent.create({
    data: { id: uuidv7(), jobId, fromStatus, toStatus, remarks, userId },
  });
}

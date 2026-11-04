import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "@/db";
import { pgSchemaFromEnv, setLocalPgSchema } from "@/lib/db/pg-schema";

type Tx = PrismaTypes.TransactionClient;

/** Works even when Prisma Client was not regenerated after adding sent_document_html. */
export async function saveSentDocumentHtml(tx: Tx, quotationId: string, html: string) {
  try {
    await tx.quotation.update({
      where: { id: quotationId },
      data: { sentDocumentHtml: html },
    });
    return;
  } catch {
    // Prisma client out of date — persist via raw SQL on the correct schema.
  }
  await setLocalPgSchema(tx);
  await tx.$executeRawUnsafe(
    `UPDATE "quotations" SET "sent_document_html" = $1 WHERE "id" = $2::uuid`,
    html,
    quotationId,
  );
}

export async function loadSentDocumentHtml(quotationId: string) {
  try {
    const rows = await prisma.$transaction(async (tx) => {
      await setLocalPgSchema(tx);
      return tx.$queryRawUnsafe<{ sent_document_html: string | null }[]>(
        `SELECT "sent_document_html" FROM "quotations" WHERE "id" = $1::uuid LIMIT 1`,
        quotationId,
      );
    });
    return rows[0]?.sent_document_html ?? null;
  } catch (error) {
    console.error("loadSentDocumentHtml failed", { quotationId, schema: pgSchemaFromEnv(), error });
    return null;
  }
}

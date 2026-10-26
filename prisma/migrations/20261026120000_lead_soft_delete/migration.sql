ALTER TABLE "leads" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);

CREATE INDEX "leads_deleted_at_idx" ON "leads"("deleted_at");

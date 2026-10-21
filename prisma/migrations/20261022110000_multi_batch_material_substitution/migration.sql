ALTER TABLE "production_material_issues"
ADD COLUMN "requested_material_id" UUID,
ADD COLUMN "location_id" UUID,
ADD COLUMN "quantity_planned" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN "uom" TEXT NOT NULL DEFAULT 'KG',
ADD COLUMN "substitution_request_id" UUID;

UPDATE "production_material_issues" AS issue
SET "quantity_planned" = issue."quantity_issued",
    "requested_material_id" = COALESCE(issue."requested_material_id", issue."material_master_id"),
    "location_id" = COALESCE(issue."location_id", job."location_id"),
    "uom" = COALESCE(material."uom", issue."uom")
FROM "job_cards" AS job, "material_masters" AS material
WHERE issue."job_id" = job."id"
  AND material."id" = issue."material_master_id";

CREATE TABLE "material_substitution_requests" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "requested_material_id" UUID NOT NULL,
  "actual_material_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "requested_qty" DECIMAL(18,3) NOT NULL,
  "uom" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "decision_reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_by" UUID NOT NULL,
  "approved_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMPTZ(6),
  CONSTRAINT "material_substitution_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_substitution_requests_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "material_substitution_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "material_substitution_requests_requested_material_id_fkey" FOREIGN KEY ("requested_material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "material_substitution_requests_actual_material_id_fkey" FOREIGN KEY ("actual_material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "material_substitution_requests_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "material_substitution_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "production_material_issues"
ADD CONSTRAINT "production_material_issues_requested_material_id_fkey"
  FOREIGN KEY ("requested_material_id") REFERENCES "material_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "production_material_issues_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "production_material_issues_substitution_request_id_fkey"
  FOREIGN KEY ("substitution_request_id") REFERENCES "material_substitution_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "production_material_issues_job_id_idx" ON "production_material_issues"("job_id");
CREATE INDEX "material_substitution_requests_plant_id_job_id_status_idx" ON "material_substitution_requests"("plant_id", "job_id", "status");
CREATE INDEX "material_substitution_requests_batch_id_idx" ON "material_substitution_requests"("batch_id");

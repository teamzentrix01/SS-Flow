-- Add Query Form fields to Lead model
ALTER TABLE "leads" ADD COLUMN "query_date" DATE;
ALTER TABLE "leads" ADD COLUMN "query_time" TIMESTAMPTZ(6);
ALTER TABLE "leads" ADD COLUMN "contact_person" TEXT;
ALTER TABLE "leads" ADD COLUMN "contact_designation" TEXT;
ALTER TABLE "leads" ADD COLUMN "address" TEXT;
ALTER TABLE "leads" ADD COLUMN "attended_by_id" UUID;
ALTER TABLE "leads" ADD COLUMN "office_remarks" TEXT;
ALTER TABLE "leads" ADD COLUMN "required_delivery_date" DATE;
ALTER TABLE "leads" ADD COLUMN "result" TEXT DEFAULT 'PENDING';
ALTER TABLE "leads" ADD COLUMN "result_reason" TEXT;

-- Add foreign key for attended_by_id
ALTER TABLE "leads" ADD CONSTRAINT "leads_attended_by_id_fkey" FOREIGN KEY ("attended_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for query_date
CREATE INDEX "leads_plant_id_query_date_idx" ON "leads"("plant_id", "query_date");

-- Add index for attended_by_id
CREATE INDEX "leads_plant_id_attended_by_id_idx" ON "leads"("plant_id", "attended_by_id");

-- Add fields to LeadItem for commercial information
ALTER TABLE "lead_items" ADD COLUMN "price_offered" DECIMAL(18,2);
ALTER TABLE "lead_items" ADD COLUMN "price_finalised" DECIMAL(18,2);
ALTER TABLE "lead_items" ADD COLUMN "estimated_weight" DECIMAL(18,3);

-- Add comment for result field
COMMENT ON COLUMN "leads"."result" IS 'Query result: PENDING, SUCCESS, or FAILURE (Price/Availability/Others)';

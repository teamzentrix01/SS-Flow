-- Lead management module

ALTER TABLE "sales_order_status_events" ADD COLUMN IF NOT EXISTS "customer_note" TEXT;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" UUID PRIMARY KEY,
  "plant_id" UUID NOT NULL REFERENCES "plants"("id"),
  "lead_number" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT NOT NULL,
  "company_name" TEXT,
  "customer_id" UUID REFERENCES "customers"("id"),
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "assignee_id" UUID REFERENCES "employees"("id"),
  "verification_notes" TEXT,
  "verified_by_id" UUID REFERENCES "users"("id"),
  "verified_at" TIMESTAMPTZ,
  "next_follow_up_at" TIMESTAMPTZ,
  "notes" TEXT,
  "lost_reason" TEXT,
  "sales_order_id" UUID UNIQUE REFERENCES "sales_orders"("id"),
  "converted_at" TIMESTAMPTZ,
  "converted_by_id" UUID REFERENCES "users"("id"),
  "created_by_id" UUID REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "leads_plant_id_lead_number_key" ON "leads"("plant_id", "lead_number");
CREATE INDEX IF NOT EXISTS "leads_plant_id_status_idx" ON "leads"("plant_id", "status");
CREATE INDEX IF NOT EXISTS "leads_plant_id_source_idx" ON "leads"("plant_id", "source");
CREATE INDEX IF NOT EXISTS "leads_plant_id_assignee_id_idx" ON "leads"("plant_id", "assignee_id");
CREATE INDEX IF NOT EXISTS "leads_plant_id_next_follow_up_at_idx" ON "leads"("plant_id", "next_follow_up_at");

CREATE TABLE IF NOT EXISTS "lead_items" (
  "id" UUID PRIMARY KEY,
  "lead_id" UUID NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "product_id" UUID REFERENCES "material_masters"("id"),
  "product_variant_id" UUID REFERENCES "product_variants"("id"),
  "item_description" TEXT,
  "quantity" DECIMAL(18,3) NOT NULL,
  "unit_id" UUID REFERENCES "units_of_measure"("id"),
  "uom" TEXT NOT NULL DEFAULT 'PCS',
  "target_price" DECIMAL(18,2),
  "specifications" JSONB NOT NULL DEFAULT '{}',
  "notes" TEXT
);
CREATE INDEX IF NOT EXISTS "lead_items_lead_id_idx" ON "lead_items"("lead_id");

CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" UUID PRIMARY KEY,
  "lead_id" UUID NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "activity_type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "performed_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "next_follow_up_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "lead_status_history" (
  "id" UUID PRIMARY KEY,
  "lead_id" UUID NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "old_status" TEXT,
  "new_status" TEXT NOT NULL,
  "changed_by_id" UUID NOT NULL REFERENCES "users"("id"),
  "reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "lead_status_history_lead_id_created_at_idx" ON "lead_status_history"("lead_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "customer_notifications" (
  "id" UUID PRIMARY KEY,
  "plant_id" UUID NOT NULL REFERENCES "plants"("id"),
  "lead_id" UUID REFERENCES "leads"("id") ON DELETE SET NULL,
  "customer_id" UUID REFERENCES "customers"("id") ON DELETE SET NULL,
  "sales_order_id" UUID REFERENCES "sales_orders"("id") ON DELETE SET NULL,
  "channel" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "provider_ref" TEXT,
  "error_detail" TEXT,
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "customer_notifications_status_created_at_idx" ON "customer_notifications"("status", "created_at");
CREATE INDEX IF NOT EXISTS "customer_notifications_sales_order_id_idx" ON "customer_notifications"("sales_order_id");

CREATE TABLE IF NOT EXISTS "lead_public_submissions" (
  "id" UUID PRIMARY KEY,
  "plant_id" UUID NOT NULL,
  "ip_hash" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL UNIQUE,
  "lead_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "lead_public_submissions_plant_ip_created_idx" ON "lead_public_submissions"("plant_id", "ip_hash", "created_at" DESC);

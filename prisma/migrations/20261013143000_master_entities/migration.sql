-- Product categories (classification; separate from inventory buckets)
CREATE TABLE "product_categories" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "parent_id" UUID,
    "category_type" TEXT NOT NULL,
    "product_form" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_categories_plant_id_code_key" ON "product_categories"("plant_id", "code");
CREATE INDEX "product_categories_plant_id_category_type_idx" ON "product_categories"("plant_id", "category_type");
CREATE INDEX "product_categories_plant_id_status_idx" ON "product_categories"("plant_id", "status");

ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Products / material masters
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "category_id" UUID;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "product_type" TEXT NOT NULL DEFAULT 'finished';
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "hsn_code" TEXT;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "purchase_uom" TEXT;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "sales_uom" TEXT;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "uom_conversion_factor" DECIMAL(18,6);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "min_stock_level" DECIMAL(18,3);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "reorder_level" DECIMAL(18,3);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "batch_tracking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "serial_tracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "length" DECIMAL(18,3);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "diameter" DECIMAL(18,3);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "weight_per_piece" DECIMAL(18,3);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "standard_scrap_pct" DECIMAL(8,4);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "default_bom_header_id" UUID;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "default_routing_id" UUID;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "purchase_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "sales_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "manufacturing_allowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "default_supplier_id" UUID;
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "purchase_price" DECIMAL(18,2);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "selling_price" DECIMAL(18,2);
ALTER TABLE "material_masters" ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(8,4);

UPDATE "material_masters" SET "product_type" = CASE "category"
    WHEN 'raw' THEN 'raw_material'
    WHEN 'semi' THEN 'semi_finished'
    WHEN 'consumable' THEN 'consumable'
    ELSE 'finished'
END WHERE "product_type" = 'finished' OR "product_type" IS NULL;

CREATE INDEX IF NOT EXISTS "material_masters_plant_id_category_id_idx" ON "material_masters"("plant_id", "category_id");
CREATE INDEX IF NOT EXISTS "material_masters_plant_id_product_type_idx" ON "material_masters"("plant_id", "product_type");

ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_default_bom_header_id_fkey"
    FOREIGN KEY ("default_bom_header_id") REFERENCES "bom_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_default_routing_id_fkey"
    FOREIGN KEY ("default_routing_id") REFERENCES "routing_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_default_supplier_id_fkey"
    FOREIGN KEY ("default_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "work_email" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "additional_skills" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "skill_level" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "assigned_machine_id" UUID;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "joining_date" DATE;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "employment_type" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "employment_status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "login_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "employees" SET "login_enabled" = true WHERE "user_id" IS NOT NULL;
UPDATE "employees" SET "employment_status" = CASE WHEN "active" = false THEN 'inactive' ELSE 'active' END;

CREATE INDEX IF NOT EXISTS "employees_plant_id_employment_status_idx" ON "employees"("plant_id", "employment_status");

ALTER TABLE "employees" ADD CONSTRAINT "employees_assigned_machine_id_fkey"
    FOREIGN KEY ("assigned_machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Job cards
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "sales_order_id" UUID;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "bom_header_id" UUID;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "bom_version" INTEGER;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "routing_id" UUID;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "current_stage" TEXT;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "assigned_team" TEXT;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "actual_start" TIMESTAMPTZ(6);
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "actual_end" TIMESTAMPTZ(6);
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "material_issue_ref" TEXT;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "hold_reason" TEXT;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "rework_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "completion_notes" TEXT;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "completed_by" UUID;
ALTER TABLE "job_cards" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ(6);

UPDATE "job_cards" jc SET "sales_order_id" = po."sales_order_id"
FROM "production_orders" po
WHERE jc."production_order_id" = po."id" AND jc."sales_order_id" IS NULL AND po."sales_order_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "job_cards_sales_order_id_idx" ON "job_cards"("sales_order_id");

ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_sales_order_id_fkey"
    FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_bom_header_id_fkey"
    FOREIGN KEY ("bom_header_id") REFERENCES "bom_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_routing_id_fkey"
    FOREIGN KEY ("routing_id") REFERENCES "routing_headers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

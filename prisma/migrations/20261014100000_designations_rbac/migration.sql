-- Role metadata
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Permission metadata
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "module" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "description" TEXT;
CREATE INDEX IF NOT EXISTS "permissions_module_idx" ON "permissions"("module");

-- Designations
CREATE TABLE IF NOT EXISTS "designations" (
  "id" UUID NOT NULL,
  "plant_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "department_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "designations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "designations_plant_id_code_key" ON "designations"("plant_id", "code");
CREATE INDEX IF NOT EXISTS "designations_plant_id_is_active_idx" ON "designations"("plant_id", "is_active");
ALTER TABLE "designations" ADD CONSTRAINT "designations_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "designations" ADD CONSTRAINT "designations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "designation_id" UUID;
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "roles" SET "is_system" = true WHERE "code" IN ('admin', 'manager', 'employee', 'customer', 'supplier', 'sales', 'purchase', 'supervisor', 'operator', 'qc');

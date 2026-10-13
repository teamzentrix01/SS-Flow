-- User profile fields and portal links
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "customer_id" UUID;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supplier_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "users_customer_id_key" ON "users"("customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "users_supplier_id_key" ON "users"("supplier_id");

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_customer_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_supplier_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

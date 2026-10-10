-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "disabled_at" TIMESTAMPTZ(6),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_plant_access" (
    "user_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,

    CONSTRAINT "user_plant_access_pkey" PRIMARY KEY ("user_id","plant_id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "user_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" UUID,
    "designation" TEXT,
    "skill" TEXT,
    "shift_id" UUID,
    "supervisor_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_masters" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "shape" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "grade" TEXT,
    "thickness" DECIMAL(18,3),
    "width" DECIMAL(18,3),
    "specs" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_batches" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "location_id" UUID,
    "batch_no" TEXT NOT NULL,
    "heat_no" TEXT,
    "grade" TEXT,
    "thickness" DECIMAL(18,3),
    "width" DECIMAL(18,3),
    "length" DECIMAL(18,3),
    "weight" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "diameter" DECIMAL(18,3),
    "finish" TEXT,
    "coating" TEXT,
    "quality_status" TEXT NOT NULL DEFAULT 'pending',
    "supplier_id" UUID,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "available_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reserved_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "qc_hold_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "wip_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "finished_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrap_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "rejected_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "dest_location_id" UUID,
    "movement_type" TEXT NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" UUID,
    "performed_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_approval',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "expected_date" DATE,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "grade" TEXT,
    "thickness" DECIMAL(18,3),
    "width" DECIMAL(18,3),
    "length" DECIMAL(18,3),
    "qty" DECIMAL(18,3) NOT NULL,
    "received_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "rate" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipts" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "received_by" UUID NOT NULL,
    "notes" TEXT,

    CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "heat_no" TEXT,
    "batch_no" TEXT NOT NULL,

    CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_inspections" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "batch_id" UUID,
    "job_id" UUID,
    "inspector_id" UUID,
    "remarks" TEXT,
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(6),

    CONSTRAINT "qc_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_headers" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scrap_rate" DECIMAL(8,4) NOT NULL DEFAULT 0.05,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bom_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_items" (
    "id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "qty_per" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',

    CONSTRAINT "bom_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_headers" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "routing_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_operations" (
    "id" UUID NOT NULL,
    "routing_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "machine_type" TEXT,

    CONSTRAINT "routing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "source_batch_id" UUID,
    "location_id" UUID NOT NULL,
    "input_qty" DECIMAL(18,3) NOT NULL,
    "target_qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "planned_start" TIMESTAMPTZ(6),
    "planned_end" TIMESTAMPTZ(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "qc_status" TEXT NOT NULL DEFAULT 'pending',
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "assignee_id" UUID,
    "supervisor_id" UUID,
    "machine_id" UUID,
    "die_id" UUID,
    "batch_id" UUID,
    "location_id" UUID NOT NULL,
    "target_qty" DECIMAL(18,3) NOT NULL,
    "allocated_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "good_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reject_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrap_qty" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "planned_start" TIMESTAMPTZ(6),
    "planned_end" TIMESTAMPTZ(6),
    "instructions" TEXT,
    "rework_of_job_id" UUID,
    "output_batch_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_dependencies" (
    "predecessor_id" UUID NOT NULL,
    "successor_id" UUID NOT NULL,

    CONSTRAINT "job_dependencies_pkey" PRIMARY KEY ("predecessor_id","successor_id")
);

-- CreateTable
CREATE TABLE "job_sessions" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "opening_reading" DECIMAL(18,3),
    "closing_reading" DECIMAL(18,3),
    "pause_reason" TEXT,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_submissions" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "good_qty" DECIMAL(18,3) NOT NULL,
    "reject_qty" DECIMAL(18,3) NOT NULL,
    "scrap_qty" DECIMAL(18,3) NOT NULL,
    "consumed_qty" DECIMAL(18,3) NOT NULL,
    "closing_reading" DECIMAL(18,3),
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "submitted_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "department_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machine_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "capacity" DECIMAL(18,3),
    "reading_required" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dies" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "die_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "location" TEXT,
    "life_limit" INTEGER NOT NULL DEFAULT 100000,
    "life_used" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_links" (
    "id" UUID NOT NULL,
    "parent_batch_id" UUID NOT NULL,
    "child_batch_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL,
    "link_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_daily_stats" (
    "plant_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "receipts_kg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "output_kg" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "scrap_kg" DECIMAL(18,3) NOT NULL DEFAULT 0,

    CONSTRAINT "plant_daily_stats_pkey" PRIMARY KEY ("plant_id","day")
);

-- CreateTable
CREATE TABLE "number_sequences" (
    "plant_id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("plant_id","prefix","year")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'KG',

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "shipped_at" TIMESTAMPTZ(6) NOT NULL,
    "shipped_by" UUID NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "qty" DECIMAL(18,3) NOT NULL,
    "uom" TEXT NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_work_orders" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reported_by" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_downtime" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "machine_downtime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" UUID,
    "reason" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "plants_code_key" ON "plants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_plant_id_name_key" ON "departments"("plant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_plant_id_code_key" ON "warehouses"("plant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_warehouse_id_code_key" ON "storage_locations"("warehouse_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_plant_id_name_key" ON "shifts"("plant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_plant_id_active_idx" ON "employees"("plant_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_plant_id_code_key" ON "employees"("plant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_plant_id_code_key" ON "suppliers"("plant_id", "code");

-- CreateIndex
CREATE INDEX "material_masters_plant_id_category_idx" ON "material_masters"("plant_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "material_masters_plant_id_code_key" ON "material_masters"("plant_id", "code");

-- CreateIndex
CREATE INDEX "material_batches_plant_id_grade_thickness_idx" ON "material_batches"("plant_id", "grade", "thickness");

-- CreateIndex
CREATE INDEX "material_batches_heat_no_idx" ON "material_batches"("heat_no");

-- CreateIndex
CREATE UNIQUE INDEX "material_batches_plant_id_batch_no_key" ON "material_batches"("plant_id", "batch_no");

-- CreateIndex
CREATE INDEX "stock_balances_plant_id_idx" ON "stock_balances"("plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_batch_id_location_id_key" ON "stock_balances"("batch_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_ledger_plant_id_created_at_idx" ON "stock_ledger"("plant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "stock_ledger_batch_id_created_at_idx" ON "stock_ledger"("batch_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "purchase_orders_plant_id_status_created_at_idx" ON "purchase_orders"("plant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_plant_id_number_key" ON "purchase_orders"("plant_id", "number");

-- CreateIndex
CREATE INDEX "purchase_order_items_order_id_idx" ON "purchase_order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_plant_id_number_key" ON "goods_receipts"("plant_id", "number");

-- CreateIndex
CREATE INDEX "qc_inspections_plant_id_status_kind_idx" ON "qc_inspections"("plant_id", "status", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "bom_headers_plant_id_product_id_version_key" ON "bom_headers"("plant_id", "product_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "routing_operations_routing_id_sequence_key" ON "routing_operations"("routing_id", "sequence");

-- CreateIndex
CREATE INDEX "production_orders_plant_id_status_idx" ON "production_orders"("plant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_plant_id_number_key" ON "production_orders"("plant_id", "number");

-- CreateIndex
CREATE INDEX "job_cards_assignee_id_status_idx" ON "job_cards"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "job_cards_plant_id_status_idx" ON "job_cards"("plant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_plant_id_number_key" ON "job_cards"("plant_id", "number");

-- CreateIndex
CREATE INDEX "job_sessions_machine_id_status_idx" ON "job_sessions"("machine_id", "status");

-- CreateIndex
CREATE INDEX "job_sessions_employee_id_started_at_idx" ON "job_sessions"("employee_id", "started_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_submissions_job_id_version_key" ON "job_submissions"("job_id", "version");

-- CreateIndex
CREATE INDEX "machines_plant_id_status_idx" ON "machines"("plant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "machines_plant_id_code_key" ON "machines"("plant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "dies_plant_id_code_key" ON "dies"("plant_id", "code");

-- CreateIndex
CREATE INDEX "batch_links_child_batch_id_idx" ON "batch_links"("child_batch_id");

-- CreateIndex
CREATE INDEX "batch_links_parent_batch_id_idx" ON "batch_links"("parent_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_plant_id_code_key" ON "customers"("plant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_plant_id_number_key" ON "sales_orders"("plant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_plant_id_number_key" ON "shipments"("plant_id", "number");

-- CreateIndex
CREATE INDEX "machine_downtime_machine_id_started_at_idx" ON "machine_downtime"("machine_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_events_resource_resource_id_idx" ON "audit_events"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "outbox_delivered_at_idx" ON "outbox"("delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_route_key_key" ON "idempotency_keys"("user_id", "route", "key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_access" ADD CONSTRAINT "user_plant_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_plant_access" ADD CONSTRAINT "user_plant_access_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_masters" ADD CONSTRAINT "material_masters_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_batches" ADD CONSTRAINT "material_batches_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_batches" ADD CONSTRAINT "material_batches_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_batches" ADD CONSTRAINT "material_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_inspections" ADD CONSTRAINT "qc_inspections_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_headers" ADD CONSTRAINT "bom_headers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bom_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_headers" ADD CONSTRAINT "routing_headers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_headers" ADD CONSTRAINT "routing_headers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_operations" ADD CONSTRAINT "routing_operations_routing_id_fkey" FOREIGN KEY ("routing_id") REFERENCES "routing_headers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "material_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_die_id_fkey" FOREIGN KEY ("die_id") REFERENCES "dies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "material_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_dependencies" ADD CONSTRAINT "job_dependencies_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_dependencies" ADD CONSTRAINT "job_dependencies_successor_id_fkey" FOREIGN KEY ("successor_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_sessions" ADD CONSTRAINT "job_sessions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_sessions" ADD CONSTRAINT "job_sessions_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_sessions" ADD CONSTRAINT "job_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dies" ADD CONSTRAINT "dies_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_links" ADD CONSTRAINT "batch_links_parent_batch_id_fkey" FOREIGN KEY ("parent_batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_links" ADD CONSTRAINT "batch_links_child_batch_id_fkey" FOREIGN KEY ("child_batch_id") REFERENCES "material_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_daily_stats" ADD CONSTRAINT "plant_daily_stats_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_sequences" ADD CONSTRAINT "number_sequences_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_work_orders" ADD CONSTRAINT "maintenance_work_orders_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_downtime" ADD CONSTRAINT "machine_downtime_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "one_active_job_per_machine" ON "job_sessions"("machine_id") WHERE "status" IN ('in_progress', 'paused');

-- AlterTable
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_buckets_nonnegative" CHECK (
  "available_qty" >= 0 AND "reserved_qty" >= 0 AND "qc_hold_qty" >= 0 AND "wip_qty" >= 0 AND "finished_qty" >= 0 AND "scrap_qty" >= 0 AND "rejected_qty" >= 0
);

-- AlterTable: Add promised_delivery_date to leads
ALTER TABLE "leads" ADD COLUMN "promised_delivery_date" DATE;

-- AlterTable: Add required_delivery_date to sales_orders
ALTER TABLE "sales_orders" ADD COLUMN "required_delivery_date" DATE;

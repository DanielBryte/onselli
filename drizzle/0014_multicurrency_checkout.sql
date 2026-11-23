ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_ngn_only";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currency_options" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_base_currency_check" CHECK ("currency" IN ('NGN', 'USD'));--> statement-breakpoint

ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_ngn_only";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "checkout_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "processor_fee_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_base_currency_check" CHECK ("currency" IN ('NGN', 'USD'));--> statement-breakpoint

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" varchar(3) NOT NULL DEFAULT 'NGN';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "total_spent_usd_minor" bigint NOT NULL DEFAULT 0;--> statement-breakpoint

ALTER TABLE "creators"
  ADD COLUMN "bachs_account_status" text NOT NULL DEFAULT 'not_created',
  ADD COLUMN "bachs_transfers_status" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN "bachs_payouts_status" text NOT NULL DEFAULT 'unknown',
  ADD COLUMN "bachs_requirements" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN "bachs_onboarded_at" timestamptz;--> statement-breakpoint

ALTER TABLE "orders"
  ADD COLUMN "provider_charge_id" text,
  ADD COLUMN "provider_transfer_id" text,
  ADD COLUMN "provider_settled_at" timestamptz;--> statement-breakpoint

CREATE UNIQUE INDEX "orders_provider_transfer_id_uq"
  ON "orders" ("provider_transfer_id") WHERE "provider_transfer_id" IS NOT NULL;--> statement-breakpoint

UPDATE "creators"
SET "bachs_account_status" = CASE WHEN "bachs_account_id" IS NULL THEN 'not_created' ELSE 'needs_action' END;--> statement-breakpoint

UPDATE "creators"
SET "bachs_payouts_status" = CASE WHEN "kyc_status" = 'approved' THEN 'active' ELSE 'unknown' END;--> statement-breakpoint

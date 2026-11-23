ALTER TABLE "creators" ADD COLUMN "bachs_account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "creators_bachs_account_id_uq" ON "creators" ("bachs_account_id") WHERE "bachs_account_id" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "payouts" ADD COLUMN "source_amount_minor" bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "source_currency" varchar(3) NOT NULL DEFAULT 'NGN';--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "fee_minor" bigint NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "payout_destination_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD COLUMN "provider_payout_id" text;--> statement-breakpoint
ALTER TABLE "payouts" ALTER COLUMN "currency" TYPE varchar(10);--> statement-breakpoint
UPDATE "payouts" SET "source_amount_minor" = "amount_minor", "source_currency" = "currency";--> statement-breakpoint

CREATE TABLE "payout_destinations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "provider_destination_id" text NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "type" text NOT NULL,
  "currency" varchar(10) NOT NULL,
  "country_code" varchar(2),
  "method" text NOT NULL,
  "status" text NOT NULL,
  "status_reason" text,
  "is_usable" boolean NOT NULL DEFAULT false,
  "masked_details" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "payout_destinations_creator_idx" ON "payout_destinations" ("creator_id", "created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_destinations_creator_default_uq" ON "payout_destinations" ("creator_id") WHERE "is_default" = true;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_destination_id_payout_destinations_id_fk" FOREIGN KEY ("payout_destination_id") REFERENCES "payout_destinations"("id");--> statement-breakpoint

CREATE TABLE "payout_quotes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "destination_id" uuid NOT NULL REFERENCES "payout_destinations"("id") ON DELETE CASCADE,
  "provider_quote_id" text NOT NULL UNIQUE,
  "source_currency" varchar(3) NOT NULL,
  "destination_currency" varchar(10) NOT NULL,
  "source_amount_minor" bigint NOT NULL,
  "destination_amount_minor" bigint NOT NULL,
  "fee_minor" bigint,
  "exchange_rate" text,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX "payout_quotes_creator_idx" ON "payout_quotes" ("creator_id", "created_at");--> statement-breakpoint

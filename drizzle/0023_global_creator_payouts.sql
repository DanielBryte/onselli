-- Allow a separate default destination per currency and method.
DROP INDEX IF EXISTS "payout_destinations_creator_default_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "payout_destinations_creator_default_uq"
  ON "payout_destinations" ("creator_id", "currency", "method")
  WHERE "is_default" = true;--> statement-breakpoint

-- Preserve the quote used to authorize a cross-currency payout.
ALTER TABLE "payouts" ADD COLUMN "quote_id" uuid;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_quote_id_payout_quotes_id_fk"
  FOREIGN KEY ("quote_id") REFERENCES "payout_quotes" ("id");--> statement-breakpoint

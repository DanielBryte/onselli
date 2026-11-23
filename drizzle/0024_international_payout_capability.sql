ALTER TABLE "creators"
  ADD COLUMN "bachs_international_payouts" boolean NOT NULL DEFAULT false;--> statement-breakpoint

INSERT INTO "settings" ("key", "value")
VALUES ('creator_payout_controls', '{"global":null,"accounts":{},"routes":{}}'::jsonb)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint

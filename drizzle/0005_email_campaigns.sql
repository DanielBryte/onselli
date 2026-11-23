ALTER TABLE "contacts" ADD COLUMN "email_suppressed_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email_suppression_reason" text;
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email_bounce_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "subject" varchar(180) NOT NULL,
  "preview_text" varchar(240),
  "html" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "scheduled_at" timestamptz,
  "queued_count" integer DEFAULT 0 NOT NULL,
  "sent_count" integer DEFAULT 0 NOT NULL,
  "delivered_count" integer DEFAULT 0 NOT NULL,
  "bounced_count" integer DEFAULT 0 NOT NULL,
  "complained_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_campaigns_creator_idx" ON "email_campaigns" USING btree ("creator_id", "created_at");
--> statement-breakpoint
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns" USING btree ("status", "scheduled_at");
--> statement-breakpoint
CREATE TABLE "email_campaign_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" uuid NOT NULL UNIQUE REFERENCES "creators"("id") ON DELETE CASCADE,
  "available" integer DEFAULT 0 NOT NULL,
  "reserved" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "email_campaign_credits_nonnegative" CHECK ("available" >= 0 AND "reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "email_campaign_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL REFERENCES "email_campaigns"("id") ON DELETE CASCADE,
  "creator_id" uuid NOT NULL REFERENCES "creators"("id") ON DELETE CASCADE,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "provider_id" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error" text,
  "sent_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_campaign_recipient_uq" ON "email_campaign_recipients" USING btree ("campaign_id", "email");
--> statement-breakpoint
CREATE INDEX "email_campaign_recipient_queue_idx" ON "email_campaign_recipients" USING btree ("campaign_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "email_campaign_recipient_contact_idx" ON "email_campaign_recipients" USING btree ("creator_id", "contact_id");

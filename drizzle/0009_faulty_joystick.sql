ALTER TABLE "billing_transactions" ADD COLUMN "billing_interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "billing_interval" text DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_billing_interval_check" CHECK ("billing_transactions"."billing_interval" IN ('month','year'));--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_billing_interval_check" CHECK ("user_subscriptions"."billing_interval" IN ('month','year'));
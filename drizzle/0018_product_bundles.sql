ALTER TYPE "product_type" ADD VALUE 'bundle';
--> statement-breakpoint
CREATE TABLE "bundle_product_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "bundle_product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "included_product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bundle_product_items_not_self_check" CHECK ("bundle_product_id" <> "included_product_id"),
  CONSTRAINT "bundle_product_items_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_product_items_product_uq" ON "bundle_product_items" ("bundle_product_id", "included_product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "bundle_product_items_position_uq" ON "bundle_product_items" ("bundle_product_id", "position");
--> statement-breakpoint
CREATE INDEX "bundle_product_items_included_idx" ON "bundle_product_items" ("included_product_id");
--> statement-breakpoint
CREATE TABLE "order_bundle_contents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
  "product_id_snapshot" uuid NOT NULL,
  "product_type_snapshot" text NOT NULL,
  "title_snapshot" text NOT NULL,
  "currency_snapshot" varchar(3) NOT NULL,
  "price_minor_snapshot" bigint NOT NULL,
  "position" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "order_bundle_contents_type_check" CHECK ("product_type_snapshot" IN ('course','download')),
  CONSTRAINT "order_bundle_contents_price_check" CHECK ("price_minor_snapshot" >= 0),
  CONSTRAINT "order_bundle_contents_position_check" CHECK ("position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "order_bundle_contents_product_uq" ON "order_bundle_contents" ("order_item_id", "product_id_snapshot");
--> statement-breakpoint
CREATE UNIQUE INDEX "order_bundle_contents_position_uq" ON "order_bundle_contents" ("order_item_id", "position");

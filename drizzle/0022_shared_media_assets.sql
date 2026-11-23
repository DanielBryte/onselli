CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"folder_id" uuid,
	"r2_key" text NOT NULL,
	"name" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_files" ADD COLUMN "asset_id" uuid;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_folder_id_media_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."media_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_folders" ADD CONSTRAINT "media_folders_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_creator_folder_idx" ON "media_assets" USING btree ("creator_id","folder_id");--> statement-breakpoint
CREATE INDEX "media_assets_creator_status_idx" ON "media_assets" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "media_folders_creator_idx" ON "media_folders" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_folders_default_uq" ON "media_folders" USING btree ("creator_id") WHERE "media_folders"."is_default" = true;--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_files_asset_idx" ON "product_files" USING btree ("asset_id");
--> statement-breakpoint
INSERT INTO "media_assets" ("creator_id", "r2_key", "name", "size_bytes", "content_type", "status", "created_at", "updated_at")
SELECT DISTINCT ON (pf."r2_key") pf."creator_id", pf."r2_key", pf."name", pf."size_bytes", pf."content_type", pf."status", pf."created_at", now()
FROM "product_files" pf
WHERE pf."status" = 'ready'
ORDER BY pf."r2_key", pf."created_at";
--> statement-breakpoint
UPDATE "product_files" pf SET "asset_id" = ma."id"
FROM "media_assets" ma
WHERE ma."r2_key" = pf."r2_key" AND ma."creator_id" = pf."creator_id" AND pf."status" = 'ready';
--> statement-breakpoint
INSERT INTO "media_folders" ("creator_id", "name", "is_default")
SELECT id, 'Uploads', true FROM "creators"
ON CONFLICT DO NOTHING;

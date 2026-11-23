ALTER TABLE "products"
  ADD COLUMN "download_delivery_mode" text DEFAULT 'uploaded_files' NOT NULL,
  ADD COLUMN "download_external_url" text;
--> statement-breakpoint

-- Preserve existing products as private-file downloads; no external URLs are inferred or exposed.
UPDATE "products"
SET "download_delivery_mode" = 'uploaded_files', "download_external_url" = NULL;
--> statement-breakpoint

ALTER TABLE "products"
  ADD CONSTRAINT "products_download_delivery_mode_check"
    CHECK ("download_delivery_mode" IN ('uploaded_files', 'external_link')),
  ADD CONSTRAINT "products_download_delivery_data_check"
    CHECK (
      ("type" = 'download' AND (
        ("download_delivery_mode" = 'uploaded_files' AND "download_external_url" IS NULL)
        OR ("download_delivery_mode" = 'external_link' AND "download_external_url" IS NOT NULL)
      ))
      OR ("type" <> 'download' AND "download_delivery_mode" = 'uploaded_files' AND "download_external_url" IS NULL)
    );
